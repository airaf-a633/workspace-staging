-- Outlook, sending (decided 2026-10-20): a reply goes out as Outlook's own reply to the customer's latest email, so
-- Microsoft threads it, quotes the history and files it in the mailbox's Sent folder. The worker needs the mailbox
-- and that email's Graph id (stored on the message when it was read).
create function public.outbound_outlook(p_message uuid)
returns table (mailbox text, graph_id text)
language sql stable security definer set search_path = '' as $$
  select mc.mailbox,
         (select m2.data ->> 'graphId' from public.messages m2
           where m2.conversation_id = c.id and m2.direction = 'in' and m2.data ? 'graphId'
           order by m2.sent_at desc limit 1)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.mail_connections mc on mc.channel_id = c.channel_id
  where m.id = p_message
$$;

revoke execute on function public.outbound_outlook(uuid) from public, anon, authenticated;
