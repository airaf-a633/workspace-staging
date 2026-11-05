-- Slack (decided 2026-11-02): one Relay Slack app that each customer adds to their workspace ("Add to Slack"),
-- listening in the Slack Connect channels the app is in. A Slack workspace is one Relay channel, found from the team
-- id Slack puts on every event (it is the channel's external id, which is already unique across Relay).
-- One chat per outside person per Slack channel: the Slack channel id is the chat's thread key.

-- Messages typed in Slack by the customer's own staff are shown in the chat as the team's, marked as sent outside Relay.
alter table public.messages drop constraint messages_source_check;
alter table public.messages add constraint messages_source_check check (source in ('customer', 'inbox', 'phone_app', 'channel_app', 'system', 'ai'));

-- Slack recommends keeping a message to about 4,000 characters (it truncates beyond 40,000).
create or replace function public.channel_max_length(p_type text) returns int language sql immutable as $$
  select case p_type when 'sms' then 1600 when 'line' then 5000 when 'slack' then 4000 else 4096 end
$$;

-- Worker only. Files something the customer's own staff typed in the channel's own app, into the right chat:
-- the chat of the message they replied to in a thread, or else the only chat in that Slack channel. When it is
-- unclear which of several people it was meant for, nothing is filed (null) rather than guessing.
create function public.ingest_team_message(
  p_channel uuid, p_external_id text, p_thread_key text, p_parent_external_id text, p_type text, p_body text, p_data jsonb, p_sent_at timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  conv public.conversations%rowtype;
  n int;
  msg uuid;
begin
  select * into ch from public.channels where id = p_channel;
  if not found then raise exception 'unknown channel %', p_channel; end if;
  if exists (select 1 from public.messages where workspace_id = ch.workspace_id and external_id = p_external_id) then return null; end if;

  if p_parent_external_id is not null then
    select c.* into conv
      from public.messages m join public.conversations c on c.id = m.conversation_id
     where m.workspace_id = ch.workspace_id and m.external_id = p_parent_external_id and c.channel_id = ch.id;
  end if;
  if conv.id is null then
    select count(*) into n from public.conversations where channel_id = ch.id and thread_key = coalesce(p_thread_key, '');
    if n <> 1 then return null; end if;
    select * into conv from public.conversations where channel_id = ch.id and thread_key = coalesce(p_thread_key, '');
  end if;

  insert into public.messages (workspace_id, conversation_id, external_id, direction, source, type, body, data, status, sent_at)
  values (ch.workspace_id, conv.id, p_external_id, 'out', 'channel_app', p_type, p_body, coalesce(p_data, '{}'), 'sent', p_sent_at)
  returning id into msg;
  update public.conversations set last_message_at = greatest(last_message_at, p_sent_at) where id = conv.id;
  return msg;
end $$;

-- Worker and web route only. Which Relay channel is this Slack workspace? Disconnected ones are returned too, so the
-- route can answer Slack and file nothing.
create function public.slack_channel_for_team(p_team text)
returns table (id uuid, workspace_id uuid, status text, settings jsonb)
language sql stable security definer set search_path = '' as $$
  select c.id, c.workspace_id, c.status, c.settings from public.channels c where c.type = 'slack' and c.external_id = p_team
$$;

-- Slack told us the app was removed from the workspace: stop sending and receiving, keep the history.
create function public.slack_app_removed(p_team text) returns void
language sql security definer set search_path = '' as $$
  update public.channels set status = 'disconnected' where type = 'slack' and external_id = p_team and status <> 'disconnected'
$$;

revoke all on function public.ingest_team_message(uuid, text, text, text, text, text, jsonb, timestamptz), public.slack_channel_for_team(text), public.slack_app_removed(text) from public, anon, authenticated;
grant execute on function public.ingest_team_message(uuid, text, text, text, text, text, jsonb, timestamptz), public.slack_channel_for_team(text), public.slack_app_removed(text) to service_role;
