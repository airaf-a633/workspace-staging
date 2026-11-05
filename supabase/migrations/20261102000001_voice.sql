-- Voice (decided 2026-11-02): a phone number the customer connects from their own Twilio account. Calls and
-- voicemails are filed as messages (type 'call' with data.call, and type 'audio' for the voicemail file). A phone
-- number cannot send text, so send_reply refuses it with cannot_reply even if a screen offers the box by mistake.
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
  if ch.type = 'voice' then raise exception 'cannot_reply' using errcode = 'P0001'; end if;
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
