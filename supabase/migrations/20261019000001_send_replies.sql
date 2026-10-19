-- M2.4 step 1, sending text replies (decided 2026-10-19). One outbound path for every channel: the inbox calls
-- send_reply(), which checks who may reply and the channel's rules, stores the message as "queued" and adds a
-- send_message job. The worker sends it through the channel's adapter (WhatsApp first) and marks it sent or
-- failed. Delivery ticks keep arriving through apply_message_status(). A retried click never sends twice.

alter table public.messages add column client_id text check (client_id is null or length(client_id) between 8 and 64);
create unique index messages_client_id_key on public.messages (workspace_id, client_id) where client_id is not null;

-- Who may reply: the holder or a helper with reply rights, or a manager whose override reaches this chat.
-- Mirrors replyAccess() in packages/domain. A chat nobody has taken must be taken first.
create function public.can_reply(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select c.status <> 'spam'
       and public.conversation_visible(c.id)
       and (
         ((c.holder_member_id = public.member_id(c.workspace_id) or public.is_collaborator(c.id))
            and coalesce(public.permission_scope(c.workspace_id, 'conversations.reply'), 'none') <> 'none')
         or (c.holder_member_id is not null and public.covers_conversation(c.id, 'conversations.override'))
       )
    from public.conversations c where c.id = p_conversation
  ), false)
$$;

-- Errors carry a short key in the message so the app can say what happened in plain words:
-- not_allowed, empty, too_long, channel_disconnected, window_closed.
create function public.send_reply(p_conversation uuid, p_body text, p_client_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  ch public.channels%rowtype;
  body text := btrim(coalesce(p_body, ''));
  existing uuid;
  msg uuid;
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
  -- WhatsApp allows free-form replies only within 24 hours of the customer's last message.
  if ch.type = 'whatsapp' and (conv.last_customer_message_at is null or conv.last_customer_message_at < now() - interval '24 hours') then
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

-- What the worker needs to send one message (service role only).
create function public.outbound_message(p_message uuid)
returns table (message_id uuid, status text, body text, channel_id uuid, channel_type text, channel_status text,
               phone_number_id text, to_address text)
language sql stable security definer set search_path = '' as $$
  select m.id, m.status, m.body, ch.id, ch.type, ch.status, wa.phone_number_id,
         (select i.address from public.contact_identities i
           where i.contact_id = c.contact_id
             and i.kind = case ch.type when 'sms' then 'phone' when 'voice' then 'phone' else ch.type end
           order by i.created_at limit 1)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.channels ch on ch.id = c.channel_id
  left join public.whatsapp_accounts wa on wa.id = ch.id
  where m.id = p_message
$$;

-- Only a queued message moves to sent; later ticks arrive through apply_message_status.
create function public.mark_message_sent(p_message uuid, p_external_id text)
returns void language sql security definer set search_path = '' as $$
  update public.messages set status = 'sent', external_id = p_external_id where id = p_message and status = 'queued'
$$;

create function public.mark_message_failed(p_message uuid, p_code text, p_text text)
returns void language sql security definer set search_path = '' as $$
  update public.messages set status = 'failed', error_code = p_code, error_text = p_text where id = p_message and status = 'queued'
$$;

revoke execute on function public.can_reply(uuid), public.send_reply(uuid, text, text), public.outbound_message(uuid),
  public.mark_message_sent(uuid, text), public.mark_message_failed(uuid, text, text) from public, anon;
revoke execute on function public.outbound_message(uuid), public.mark_message_sent(uuid, text), public.mark_message_failed(uuid, text, text)
  from authenticated;
grant execute on function public.can_reply(uuid), public.send_reply(uuid, text, text) to authenticated;
