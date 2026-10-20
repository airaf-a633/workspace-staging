-- Website chat (decided 2026-10-19): the first channel that needs no outside approval. A business adds a website-chat
-- channel and pastes a small script on its site; visitors chat without signing in.
--
-- * The channel's external_id is its public widget key. Its settings hold the look (colour, greeting, position)
--   and the sites it may run on.
-- * A visitor's browser keeps a random secret. Relay stores only its SHA-256 fingerprint as the contact identity
--   (kind 'webchat'), so a leaked row can't be used to pose as a visitor.
-- * Visitor messages go through ingest_inbound like every channel. Replies use send_reply; the worker's webchat
--   adapter marks them sent, and the widget picks them up (delivered and read when the visitor sees them).
-- * Everything the widget does runs through the server's service role, never as an anonymous database user.

-- ---------------------------------------------------------------------------
-- Owners and admins manage the channel
-- ---------------------------------------------------------------------------

create function public.create_webchat_channel(p_workspace uuid, p_name text, p_settings jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ch uuid;
  default_team uuid;
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'need_name' using errcode = '22023';
  end if;
  select id into default_team from public.teams where workspace_id = p_workspace and is_default;
  insert into public.channels (workspace_id, type, name, external_id, team_id, settings, connected_by)
  values (p_workspace, 'webchat', btrim(p_name), encode(extensions.gen_random_bytes(16), 'hex'), default_team,
          coalesce(p_settings, '{}'), public.member_id(p_workspace))
  returning id into ch;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'connect', 'channels', ch::text, jsonb_build_object('type', 'webchat'));
  return ch;
end $$;

create function public.update_webchat_channel(p_channel uuid, p_name text, p_settings jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
begin
  select * into ch from public.channels where id = p_channel and type = 'webchat';
  if not found or not public.has_permission(ch.workspace_id, 'numbers.manage') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then
    raise exception 'need_name' using errcode = '22023';
  end if;
  update public.channels set name = btrim(p_name), settings = coalesce(p_settings, '{}') where id = ch.id;
end $$;

-- ---------------------------------------------------------------------------
-- What the widget may do (service role only; the server checks the key and the visitor)
-- ---------------------------------------------------------------------------

-- The widget's look, by its public key. Nothing private: no team, no members, no ids beyond the key.
create function public.webchat_config(p_key text)
returns table (business text, channel_name text, settings jsonb, live boolean)
language sql stable security definer set search_path = '' as $$
  select w.name, c.name, c.settings, c.status = 'connected'
  from public.channels c join public.workspaces w on w.id = c.workspace_id
  where c.type = 'webchat' and c.external_id = p_key
$$;

-- One visitor message. Idempotent on the client's id; at most 10 messages a minute per visitor.
create function public.webchat_send(p_key text, p_visitor text, p_client_id text, p_body text, p_name text default null, p_email text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  body text := btrim(coalesce(p_body, ''));
  contact uuid;
  recent int;
  msg uuid;
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
begin
  select * into ch from public.channels where type = 'webchat' and external_id = p_key;
  if not found or ch.status <> 'connected' then raise exception 'unknown_widget' using errcode = 'P0002'; end if;
  if p_visitor !~ '^[0-9a-f]{64}$' then raise exception 'bad_visitor' using errcode = '22023'; end if;
  if p_client_id !~ '^[0-9a-zA-Z-]{8,64}$' then raise exception 'bad_client_id' using errcode = '22023'; end if;
  if body = '' then raise exception 'empty' using errcode = '22023'; end if;
  if length(body) > 4000 then raise exception 'too_long' using errcode = '22023'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;

  select count(*) into recent
    from public.messages m
    join public.conversations c on c.id = m.conversation_id
    join public.contact_identities i on i.contact_id = c.contact_id
   where c.channel_id = ch.id and i.kind = 'webchat' and i.address = p_visitor
     and m.direction = 'in' and m.created_at > now() - interval '1 minute';
  if recent >= 10 then raise exception 'rate_limited' using errcode = 'P0001'; end if;

  msg := public.ingest_inbound(ch.id, 'webchat', p_visitor, nullif(btrim(coalesce(p_name, '')), ''), 'wc:' || p_client_id,
                               'text', body, null, '{}', null, now());
  if msg is null then
    select id into msg from public.messages where workspace_id = ch.workspace_id and external_id = 'wc:' || p_client_id;
    return msg;
  end if;

  -- An email the visitor gave lets the team follow up after they leave. It never takes over another contact's address.
  if v_email is not null then
    select contact_id into contact from public.contact_identities where workspace_id = ch.workspace_id and kind = 'webchat' and address = p_visitor;
    update public.contacts set email = coalesce(public.contacts.email, v_email) where id = contact;
    insert into public.contact_identities (workspace_id, contact_id, kind, address)
    values (ch.workspace_id, contact, 'email', v_email)
    on conflict (workspace_id, kind, address) do nothing;
  end if;
  return msg;
end $$;

-- The visitor's own thread: their messages and the team's replies, never notes or events. Fetching marks the
-- team's replies as read, because the widget only fetches while the visitor has it open.
create function public.webchat_thread(p_key text, p_visitor text)
returns table (id uuid, mine boolean, body text, sent_at timestamptz, author text, status text)
language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  conv uuid;
begin
  select * into ch from public.channels where type = 'webchat' and external_id = p_key;
  if not found then raise exception 'unknown_widget' using errcode = 'P0002'; end if;
  select c.id into conv
    from public.conversations c
    join public.contact_identities i on i.contact_id = c.contact_id
   where c.channel_id = ch.id and i.kind = 'webchat' and i.address = p_visitor
   order by c.created_at desc limit 1;
  if conv is null then return; end if;

  update public.messages um set status = 'read'
   where um.conversation_id = conv and um.direction = 'out' and um.status in ('sent', 'delivered');

  return query
    select m.id, m.direction = 'in', m.body, m.sent_at, case when m.direction = 'out' then mem.display_name end, m.status
      from public.messages m
      left join public.members mem on mem.id = m.sent_by_member
     where m.conversation_id = conv and m.type = 'text' and (m.direction = 'in' or m.status in ('sent', 'delivered', 'read'))
     order by m.sent_at, m.created_at
     limit 200;
end $$;

revoke execute on function public.create_webchat_channel(uuid, text, jsonb), public.update_webchat_channel(uuid, text, jsonb),
  public.webchat_config(text), public.webchat_send(text, text, text, text, text, text), public.webchat_thread(text, text)
  from public, anon;
revoke execute on function public.webchat_config(text), public.webchat_send(text, text, text, text, text, text), public.webchat_thread(text, text)
  from authenticated;
grant execute on function public.create_webchat_channel(uuid, text, jsonb), public.update_webchat_channel(uuid, text, jsonb) to authenticated;
