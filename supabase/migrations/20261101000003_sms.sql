-- SMS (decided 2026-11-01).
--
-- * Each channel has its own longest text (Twilio takes up to 1,600 characters, LINE 5,000, the rest 4,096).
-- * A customer's STOP (and START) is recorded: the person is marked opted out of SMS marketing, and the chat
--   gets a small line. Twilio blocks the number itself; this makes Relay's own records agree, so a later
--   campaign skips them.

create function public.channel_max_length(p_type text) returns int language sql immutable as $$
  select case p_type when 'sms' then 1600 when 'line' then 5000 else 4096 end
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
  select * into ch from public.channels where id = conv.channel_id;
  if body = '' then raise exception 'empty' using errcode = '22023'; end if;
  if length(body) > public.channel_max_length(ch.type) then raise exception 'too_long' using errcode = '22023'; end if;

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

alter table public.conversation_events drop constraint conversation_events_kind_check;
alter table public.conversation_events add constraint conversation_events_kind_check
  check (kind in ('claimed', 'handed_to_person', 'handed_to_team', 'resolved', 'reopened', 'spam', 'not_spam', 'asked_collab',
                  'collab_added', 'collab_removed', 'collab_declined', 'customer_blocked', 'customer_unblocked',
                  'customer_opted_out', 'customer_opted_in'));

-- Worker only. Writes a block/unblock/opt-out/opt-in line in the customer's conversation on this channel. An opt-out
-- also records "opted out" for this channel; an opt-in only lifts an opt-out that came from the customer's own STOP
-- (a person's other consent choices are never undone by a text). Does nothing if they have no conversation yet.
create or replace function public.record_channel_event(p_channel uuid, p_kind text, p_identity_kind text, p_address text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  conv public.conversations%rowtype;
  latest text;
begin
  if p_kind not in ('customer_blocked', 'customer_unblocked', 'customer_opted_out', 'customer_opted_in') then raise exception 'bad_kind' using errcode = '22023'; end if;
  select * into ch from public.channels where id = p_channel;
  if not found then return; end if;
  select c.* into conv
    from public.conversations c
    join public.contact_identities i on i.contact_id = c.contact_id
   where c.channel_id = p_channel and i.workspace_id = ch.workspace_id and i.kind = p_identity_kind and i.address = p_address
   order by c.created_at limit 1;
  if not found then return; end if;

  if p_kind = 'customer_opted_out' then
    insert into public.contact_consent (workspace_id, contact_id, channel, status, source)
    values (ch.workspace_id, conv.contact_id, ch.type, 'out', 'Customer replied STOP')
    on conflict (contact_id, channel) do update set status = 'out', source = 'Customer replied STOP', set_by = null, set_at = now();
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (ch.workspace_id, null, 'consent', 'contacts', conv.contact_id::text, jsonb_build_object('channel', ch.type, 'status', 'out', 'source', 'Customer replied STOP'));
  elsif p_kind = 'customer_opted_in' then
    delete from public.contact_consent where contact_id = conv.contact_id and channel = ch.type and status = 'out' and source = 'Customer replied STOP';
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (ch.workspace_id, null, 'consent', 'contacts', conv.contact_id::text, jsonb_build_object('channel', ch.type, 'status', 'unknown', 'source', 'Customer replied START'));
  end if;

  select e.kind into latest from public.conversation_events e
   where e.conversation_id = conv.id
     and e.kind in ('customer_blocked', 'customer_unblocked', 'customer_opted_out', 'customer_opted_in')
     and (e.kind like '%block%') = (p_kind like '%block%')
   order by e.created_at desc limit 1;
  if latest = p_kind then return; end if;
  -- clock_timestamp(): events written in quick succession keep their real order.
  insert into public.conversation_events (workspace_id, conversation_id, kind, created_at) values (ch.workspace_id, conv.id, p_kind, clock_timestamp());
end $$;
