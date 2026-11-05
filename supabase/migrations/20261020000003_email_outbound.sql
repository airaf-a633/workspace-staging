-- Email, part 2: sending replies (decided 2026-10-19). The worker sends through Postmark. Threading headers come
-- from the conversation: In-Reply-To names the customer's latest email, References carries the thread's first
-- email and the rest of the thread, so the customer's mail app keeps one thread and their reply finds its way back.
-- Replies come from the business's own address once its domain is verified, otherwise from a Relay address with
-- Reply-To set to theirs. Domain verification (DKIM through Postmark) is stored on the channel.

-- What the worker needs to send one email reply (service role only).
create function public.outbound_email(p_message uuid)
returns table (subject text, thread_key text, in_reply_to text, refs text[], settings jsonb, token text, sender text)
language sql stable security definer set search_path = '' as $$
  select c.subject, c.thread_key,
         (select m2.external_id from public.messages m2
           where m2.conversation_id = c.id and m2.direction = 'in' and m2.external_id is not null
           order by m2.sent_at desc limit 1),
         array(select x.external_id from (
                 select m3.external_id, m3.sent_at from public.messages m3
                  where m3.conversation_id = c.id and m3.external_id like '<%>'
                  order by m3.sent_at desc limit 20) x
               order by x.sent_at),
         ch.settings, ch.external_id, mem.display_name
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.channels ch on ch.id = c.channel_id
  left join public.members mem on mem.id = m.sent_by_member
  where m.id = p_message and ch.type = 'email'
$$;

-- Domain verification state, kept on the channel. Only people who manage channels change it.
create function public.set_email_domain(p_channel uuid, p_domain jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
begin
  select * into ch from public.channels where id = p_channel and type = 'email';
  if not found or not public.has_permission(ch.workspace_id, 'numbers.manage') then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  update public.channels
     set settings = settings || jsonb_build_object('domain', p_domain, 'domainVerified', coalesce((p_domain ->> 'verified')::boolean, false))
   where id = ch.id;
end $$;

revoke execute on function public.outbound_email(uuid), public.set_email_domain(uuid, jsonb) from public, anon;
revoke execute on function public.outbound_email(uuid) from authenticated;
grant execute on function public.set_email_domain(uuid, jsonb) to authenticated;
