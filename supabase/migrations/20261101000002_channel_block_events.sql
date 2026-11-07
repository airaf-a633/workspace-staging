-- LINE (decided 2026-11-01): when someone blocks the account, the chat says so. LINE accepts a message to a person
-- who blocked the account and silently drops it, so the team could otherwise keep replying to no one. The same
-- trail also records when they add the account again. Any channel can use it.

alter table public.conversation_events drop constraint conversation_events_kind_check;
alter table public.conversation_events add constraint conversation_events_kind_check
  check (kind in ('claimed', 'handed_to_person', 'handed_to_team', 'resolved', 'reopened', 'spam', 'not_spam', 'asked_collab',
                  'collab_added', 'collab_removed', 'collab_declined', 'customer_blocked', 'customer_unblocked'));

-- Worker only. Writes one line in the customer's conversation on this channel. Does nothing if they have no
-- conversation yet, or if the latest block/unblock line already says the same thing.
create function public.record_channel_event(p_channel uuid, p_kind text, p_identity_kind text, p_address text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  conv uuid;
  latest text;
begin
  if p_kind not in ('customer_blocked', 'customer_unblocked') then raise exception 'bad_kind' using errcode = '22023'; end if;
  select * into ch from public.channels where id = p_channel;
  if not found then return; end if;
  select c.id into conv
    from public.conversations c
    join public.contact_identities i on i.contact_id = c.contact_id
   where c.channel_id = p_channel and i.workspace_id = ch.workspace_id and i.kind = p_identity_kind and i.address = p_address
   order by c.created_at limit 1;
  if conv is null then return; end if;
  select e.kind into latest from public.conversation_events e
   where e.conversation_id = conv and e.kind in ('customer_blocked', 'customer_unblocked') order by e.created_at desc limit 1;
  if latest = p_kind then return; end if;
  -- clock_timestamp(): events written in quick succession keep their real order.
  insert into public.conversation_events (workspace_id, conversation_id, kind, created_at) values (ch.workspace_id, conv, p_kind, clock_timestamp());
end $$;

revoke all on function public.record_channel_event(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.record_channel_event(uuid, text, text, text) to service_role;
