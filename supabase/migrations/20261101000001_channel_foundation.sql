-- The other channels, step 0 (decided 2026-11-01): what every credential-based channel shares.
--
-- * Credentials (a bot token, a signing secret, a Twilio auth token) live in Vault, one row per name, never in
--   the channel's settings and never readable by a signed-in person: only the server and worker read them.
-- * connect_channel() creates the channel, stores its credentials and gives it a random webhook key. The
--   provider is told to call /api/webhooks/<provider>/<key>.
-- * Provider webhooks are checked by the route, stored as a 'channel' event, and filed by the worker.
-- * Each channel has its own reply window (WhatsApp 24 hours, TikTok and WeChat 48, Viber 24, the rest none).
-- * The worker gets what it needs to reply (settings, thread, the customer's last message) from outbound_message().

-- ---------------------------------------------------------------------------
-- Credentials
-- ---------------------------------------------------------------------------

create table public.channel_credentials (
  channel_id uuid not null references public.channels (id) on delete cascade,
  name text not null check (length(name) between 1 and 60),
  secret_id uuid not null,
  primary key (channel_id, name)
);
alter table public.channel_credentials enable row level security;
revoke all on public.channel_credentials from anon, authenticated;

-- Deleting a channel (or replacing a credential) removes the secret itself from Vault.
create function public.channel_credentials_forget() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end $$;
create trigger channel_credentials_forget after delete on public.channel_credentials
  for each row execute function public.channel_credentials_forget();

-- A webhook key is how a provider's call is matched to a channel. It's part of the address, so it's random.
create unique index channels_webhook_key on public.channels ((settings ->> 'webhook_key')) where settings ? 'webhook_key';

-- Internal: stores or replaces credentials. Not callable by anyone outside the database.
create function public.put_channel_secrets(p_channel uuid, p_secrets jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  k text;
  v text;
begin
  for k, v in select key, value from jsonb_each_text(coalesce(p_secrets, '{}')) loop
    if coalesce(btrim(v), '') = '' then continue; end if;
    delete from public.channel_credentials where channel_id = p_channel and name = k;
    insert into public.channel_credentials (channel_id, name, secret_id)
    values (p_channel, k, vault.create_secret(v, 'channel_' || p_channel || '_' || k || '_' || extract(epoch from clock_timestamp())::bigint, 'Channel credential'));
  end loop;
end $$;
revoke all on function public.put_channel_secrets(uuid, jsonb) from public, anon, authenticated;

-- Channel types that connect with credentials (WhatsApp, website chat and email have their own flows).
create function public.is_credential_channel(p_type text) returns boolean language sql immutable as $$
  select p_type in ('telegram', 'line', 'sms', 'voice', 'slack', 'discord', 'teams', 'tiktok', 'x', 'viber', 'wechat', 'apple', 'api')
$$;

-- Owners and admins (numbers.manage) connect a channel. Returns its id and webhook key.
-- Errors: not_allowed, bad_type, need_name, already_connected.
create function public.connect_channel(p_workspace uuid, p_type text, p_name text, p_external_id text, p_settings jsonb, p_secrets jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  ch uuid;
  team uuid;
  key text := encode(extensions.gen_random_bytes(16), 'hex');
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.is_credential_channel(p_type) then raise exception 'bad_type' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  select id into team from public.teams where workspace_id = p_workspace and is_default;
  begin
    insert into public.channels (workspace_id, type, name, external_id, team_id, settings, connected_by)
    values (p_workspace, p_type, btrim(p_name), nullif(btrim(coalesce(p_external_id, '')), ''), team,
            coalesce(p_settings, '{}') || jsonb_build_object('webhook_key', key), public.member_id(p_workspace))
    returning id into ch;
  exception when unique_violation then
    raise exception 'already_connected' using errcode = '23505';
  end;
  perform public.put_channel_secrets(ch, p_secrets);
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'connect', 'channels', ch::text, jsonb_build_object('type', p_type));
  return jsonb_build_object('id', ch, 'key', key);
end $$;

-- Changing a channel: rename it, merge settings, replace credentials (which reconnects it).
create function public.update_channel_credentials(p_channel uuid, p_settings jsonb, p_secrets jsonb, p_name text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare ch public.channels%rowtype;
begin
  select * into ch from public.channels where id = p_channel;
  if not found or not public.has_permission(ch.workspace_id, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not public.is_credential_channel(ch.type) then raise exception 'bad_type' using errcode = '22023'; end if;
  if p_name is not null and length(btrim(p_name)) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  update public.channels
     set name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
         settings = (settings || (coalesce(p_settings, '{}') - 'webhook_key')),
         -- Only replacing credentials reconnects; renaming or editing settings never changes the status.
         status = case when coalesce(p_secrets, '{}'::jsonb) <> '{}'::jsonb then 'connected' else status end
   where id = p_channel;
  perform public.put_channel_secrets(p_channel, p_secrets);
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (ch.workspace_id, public.member_id(ch.workspace_id), 'update', 'channels', ch.id::text, jsonb_build_object('type', ch.type));
end $$;

-- Disconnecting keeps the history (read-only) and stops sending and receiving.
create function public.disconnect_channel(p_channel uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare ch public.channels%rowtype;
begin
  select * into ch from public.channels where id = p_channel;
  if not found or not public.has_permission(ch.workspace_id, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.channels set status = 'disconnected' where id = p_channel;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (ch.workspace_id, public.member_id(ch.workspace_id), 'disconnect', 'channels', ch.id::text, jsonb_build_object('type', ch.type));
end $$;

create function public.channel_secrets(p_channel uuid) returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(cc.name, s.decrypted_secret), '{}')
  from public.channel_credentials cc join vault.decrypted_secrets s on s.id = cc.secret_id
  where cc.channel_id = p_channel
$$;

-- Server and worker only: the channel behind a webhook address, with its decrypted credentials.
create function public.channel_for_webhook(p_type text, p_key text)
returns table (id uuid, workspace_id uuid, status text, settings jsonb, secrets jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.workspace_id, c.status, c.settings, public.channel_secrets(c.id)
  from public.channels c where c.type = p_type and c.settings ->> 'webhook_key' = p_key
$$;

revoke all on function public.channel_for_webhook(text, text), public.channel_secrets(uuid) from public, anon, authenticated;
grant execute on function public.channel_for_webhook(text, text), public.channel_secrets(uuid) to service_role;
revoke all on function public.connect_channel(uuid, text, text, text, jsonb, jsonb), public.update_channel_credentials(uuid, jsonb, jsonb, text), public.disconnect_channel(uuid) from public, anon;
grant execute on function public.connect_channel(uuid, text, text, text, jsonb, jsonb), public.update_channel_credentials(uuid, jsonb, jsonb, text), public.disconnect_channel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Webhooks: one 'channel' provider; the payload says which channel and carries the provider's body
-- ---------------------------------------------------------------------------

alter table public.webhook_events drop constraint webhook_events_provider_check;
alter table public.webhook_events add constraint webhook_events_provider_check check (provider in ('whatsapp', 'postmark', 'channel'));

-- ---------------------------------------------------------------------------
-- Reply windows, per channel
-- ---------------------------------------------------------------------------

-- null = no window. Only rules the platforms publish are enforced here (the same as the screens).
create function public.channel_reply_window(p_type text) returns interval language sql immutable as $$
  select case p_type when 'whatsapp' then interval '24 hours' when 'viber' then interval '24 hours'
                     when 'tiktok' then interval '48 hours' when 'wechat' then interval '48 hours' end
$$;

create or replace function public.send_reply(p_conversation uuid, p_body text, p_client_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  ch public.channels%rowtype;
  body text := btrim(coalesce(p_body, ''));
  existing uuid;
  msg uuid;
  win interval;
begin
  if p_client_id is not null then
    select id into existing from public.messages where workspace_id = conv.workspace_id and client_id = p_client_id;
    if existing is not null then return existing; end if;
  end if;
  if not public.can_reply(conv.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if body = '' then raise exception 'empty' using errcode = '22023'; end if;
  if length(body) > 4096 then raise exception 'too_long' using errcode = '22023'; end if;

  select * into ch from public.channels where id = conv.channel_id;
  if ch.status = 'disconnected' then raise exception 'channel_disconnected' using errcode = 'P0001'; end if;
  win := public.channel_reply_window(ch.type);
  if win is not null and (conv.last_customer_message_at is null or conv.last_customer_message_at < now() - win) then
    raise exception 'window_closed' using errcode = 'P0001';
  end if;

  insert into public.messages (workspace_id, conversation_id, direction, source, type, body, status, sent_by_member, sent_at, client_id)
  values (conv.workspace_id, conv.id, 'out', 'inbox', 'text', body, 'queued', public.member_id(conv.workspace_id), now(), p_client_id)
  returning id into msg;
  update public.conversations
     set last_message_at = now(), unread_count = 0,
         status = case when status = 'resolved' then 'open' else status end, resolved_at = null
   where id = conv.id;
  perform public.enqueue_job('send_message', jsonb_build_object('message_id', msg), 10::smallint);
  return msg;
end $$;

-- ---------------------------------------------------------------------------
-- What the worker needs to reply: settings, the thread, and the customer's latest message (a reply token lives there)
-- ---------------------------------------------------------------------------

drop function public.outbound_message(uuid);
create function public.outbound_message(p_message uuid)
returns table (message_id uuid, status text, body text, channel_id uuid, channel_type text, channel_status text,
               phone_number_id text, to_address text, settings jsonb, thread_key text, last_inbound jsonb, last_inbound_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select m.id, m.status, m.body, ch.id, ch.type, ch.status, wa.phone_number_id,
         (select i.address from public.contact_identities i
           where i.contact_id = c.contact_id
             and i.kind = case ch.type when 'sms' then 'phone' when 'voice' then 'phone' else ch.type end
           order by i.created_at limit 1),
         ch.settings, c.thread_key,
         (select x.data from public.messages x where x.conversation_id = c.id and x.direction = 'in' order by x.sent_at desc limit 1),
         (select x.sent_at from public.messages x where x.conversation_id = c.id and x.direction = 'in' order by x.sent_at desc limit 1)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.channels ch on ch.id = c.channel_id
  left join public.whatsapp_accounts wa on wa.id = ch.id
  where m.id = p_message
$$;
revoke execute on function public.outbound_message(uuid) from public, anon, authenticated;
grant execute on function public.outbound_message(uuid) to service_role;
