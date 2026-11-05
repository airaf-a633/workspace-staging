-- Email channel, part 1: receiving (decided 2026-10-19). Each email channel gets a forwarding address
-- {token}@{inbound domain}; the business forwards its own support address there. Postmark posts each email to
-- /api/webhooks/postmark, which stores it like Meta's webhooks; the worker files it into a conversation.
-- Threading: a reply joins the conversation whose root Message-ID (thread_key) or any message appears in its
-- References / In-Reply-To headers; otherwise it starts a new thread.

alter table public.webhook_events drop constraint webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check check (provider in ('whatsapp', 'postmark'));

-- ---------------------------------------------------------------------------
-- Owners and admins manage the channel
-- ---------------------------------------------------------------------------

create function public.create_email_channel(p_workspace uuid, p_name text, p_address text, p_from_name text, p_signature text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ch uuid;
  default_team uuid;
  token text;
  addr text := lower(btrim(coalesce(p_address, '')));
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_address' using errcode = '22023'; end if;
  -- "northwind-3fa9c2": readable, and the random part makes it unguessable.
  select left(regexp_replace(lower(slug), '[^a-z0-9]', '', 'g'), 20) || '-' || encode(extensions.gen_random_bytes(3), 'hex')
    into token from public.workspaces where id = p_workspace;
  select id into default_team from public.teams where workspace_id = p_workspace and is_default;
  insert into public.channels (workspace_id, type, name, external_id, team_id, settings, connected_by)
  values (p_workspace, 'email', btrim(p_name), token, default_team,
          jsonb_build_object('address', addr, 'fromName', nullif(btrim(coalesce(p_from_name, '')), ''),
                             'signature', nullif(btrim(coalesce(p_signature, '')), ''), 'domainVerified', false),
          public.member_id(p_workspace))
  returning id into ch;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'connect', 'channels', ch::text, jsonb_build_object('type', 'email', 'address', addr));
  return ch;
end $$;

create function public.update_email_channel(p_channel uuid, p_name text, p_address text, p_from_name text, p_signature text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  addr text := lower(btrim(coalesce(p_address, '')));
begin
  select * into ch from public.channels where id = p_channel and type = 'email';
  if not found or not public.has_permission(ch.workspace_id, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_address' using errcode = '22023'; end if;
  update public.channels
     set name = btrim(p_name),
         settings = settings
           || jsonb_build_object('fromName', nullif(btrim(coalesce(p_from_name, '')), ''), 'signature', nullif(btrim(coalesce(p_signature, '')), ''))
           -- A new address must be verified again before replies come from it.
           || case when settings ->> 'address' is distinct from addr then jsonb_build_object('address', addr, 'domainVerified', false) else '{}'::jsonb end
   where id = ch.id;
end $$;

-- ---------------------------------------------------------------------------
-- The worker's side (service role only)
-- ---------------------------------------------------------------------------

-- The email channel a forwarding token belongs to.
create function public.email_channel_by_token(p_token text)
returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.channels where type = 'email' and external_id = lower(p_token) and status = 'connected'
$$;

-- Which existing thread an email belongs to, from its References and In-Reply-To ids. Null = a new thread.
create function public.email_thread_for(p_channel uuid, p_refs text[])
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select c.thread_key from public.conversations c where c.channel_id = p_channel and c.thread_key = any (p_refs) limit 1),
    (select c.thread_key from public.messages m join public.conversations c on c.id = m.conversation_id
      where c.channel_id = p_channel and m.external_id = any (p_refs) order by m.sent_at desc limit 1)
  )
$$;

-- Attachments beyond the first are listed on the message (the first is its media, as for WhatsApp).
create function public.add_message_attachment(p_message uuid, p_path text, p_name text, p_mime text, p_size bigint)
returns void language sql security definer set search_path = '' as $$
  update public.messages
     set data = jsonb_set(coalesce(data, '{}'), '{attachments}',
                          coalesce(data -> 'attachments', '[]'::jsonb) || jsonb_build_array(jsonb_build_object('path', p_path, 'name', p_name, 'mime', p_mime, 'size', p_size)))
   where id = p_message
$$;

revoke execute on function public.create_email_channel(uuid, text, text, text, text), public.update_email_channel(uuid, text, text, text, text),
  public.email_channel_by_token(text), public.email_thread_for(uuid, text[]), public.add_message_attachment(uuid, text, text, text, bigint)
  from public, anon;
revoke execute on function public.email_channel_by_token(text), public.email_thread_for(uuid, text[]), public.add_message_attachment(uuid, text, text, text, bigint)
  from authenticated;
grant execute on function public.create_email_channel(uuid, text, text, text, text), public.update_email_channel(uuid, text, text, text, text) to authenticated;
