-- "Continue with Google" (decided 2026-10-20). Same shape as Outlook, with two differences: Relay checks Gmail every
-- minute through its history feed (push through Pub/Sub can come later without changing this), and only the
-- signed-in mailbox is connected (teams sign in as support@ itself). Replies are sent through Gmail into the same
-- Gmail thread, so they show in its Sent folder. The connection's delta_link holds Gmail's last history id.

create function public.finish_gmail_channel(p_pending uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.oauth_pending%rowtype;
  ch uuid;
  default_team uuid;
begin
  select * into p from public.oauth_pending where id = p_pending and provider = 'gmail' for update;
  if not found or p.created_at < now() - interval '15 minutes' or p.member_id is distinct from public.member_id(p.workspace_id) then
    raise exception 'expired' using errcode = 'P0002';
  end if;
  if not public.has_permission(p.workspace_id, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  if exists (select 1 from public.channels where type = 'email' and external_id = 'gmail:' || p.account) then
    raise exception 'already_connected' using errcode = '23505';
  end if;

  select id into default_team from public.teams where workspace_id = p.workspace_id and is_default;
  insert into public.channels (workspace_id, type, name, external_id, team_id, settings, connected_by)
  values (p.workspace_id, 'email', btrim(p_name), 'gmail:' || p.account, default_team,
          jsonb_build_object('provider', 'gmail', 'address', p.account, 'account', p.account, 'domainVerified', true),
          p.member_id)
  returning id into ch;
  insert into public.mail_connections (channel_id, workspace_id, provider, account, mailbox, refresh_secret_id)
  values (ch, p.workspace_id, 'gmail', p.account, p.account, p.refresh_secret_id);
  delete from public.oauth_pending where id = p.id;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p.workspace_id, p.member_id, 'connect', 'channels', ch::text, jsonb_build_object('type', 'email', 'provider', 'gmail', 'mailbox', p.account));
  perform public.enqueue_job('mail_subscribe', jsonb_build_object('channel_id', ch), 5::smallint);
  return ch;
end $$;

-- Outlook renews push subscriptions and checks every 5 minutes as a safety net; Gmail has no subscription yet and
-- is checked every minute.
create or replace function public.mail_connections_due()
returns table (channel_id uuid, renew boolean)
language sql stable security definer set search_path = '' as $$
  select m.channel_id,
         m.provider = 'outlook' and (m.subscription_expires is null or m.subscription_expires < now() + interval '12 hours')
              or m.delta_link is null
  from public.mail_connections m join public.channels c on c.id = m.channel_id
  where c.status = 'connected'
    and (m.delta_link is null
         or (m.provider = 'outlook' and (m.subscription_expires is null or m.subscription_expires < now() + interval '12 hours'
                                          or m.last_sync_at is null or m.last_sync_at < now() - interval '5 minutes'))
         or (m.provider = 'gmail' and (m.last_sync_at is null or m.last_sync_at < now() - interval '50 seconds')))
$$;

-- What the worker needs to reply inside the customer's Gmail thread.
create function public.outbound_gmail(p_message uuid)
returns table (mailbox text, thread_id text)
language sql stable security definer set search_path = '' as $$
  select mc.mailbox,
         (select m2.data ->> 'gmailThreadId' from public.messages m2
           where m2.conversation_id = c.id and m2.direction = 'in' and m2.data ? 'gmailThreadId'
           order by m2.sent_at desc limit 1)
  from public.messages m
  join public.conversations c on c.id = m.conversation_id
  join public.mail_connections mc on mc.channel_id = c.channel_id
  where m.id = p_message
$$;

revoke execute on function public.finish_gmail_channel(uuid, text), public.outbound_gmail(uuid) from public, anon;
revoke execute on function public.outbound_gmail(uuid) from authenticated;
grant execute on function public.finish_gmail_channel(uuid, text) to authenticated;
