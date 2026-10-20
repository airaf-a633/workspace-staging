-- "Continue with Outlook" (decided 2026-10-20). A business signs in with Microsoft and picks a mailbox (their own,
-- or a shared one such as support@). It becomes an email channel with provider 'outlook'. Relay reads new mail
-- through Microsoft Graph (push notifications, plus a check every few minutes as a safety net) and replies through
-- Graph too, so replies show in Outlook's Sent folder. Microsoft's refresh token lives in Vault and is never
-- readable by app users. Disconnecting keeps the history; a broken connection shows "Reconnect".

-- A sign-in that hasn't been turned into a channel yet: lives 15 minutes, only for the person who signed in.
create table public.oauth_pending (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  provider text not null check (provider in ('outlook', 'gmail')),
  account text not null,                                   -- the signed-in person's address
  refresh_secret_id uuid not null,
  created_at timestamptz not null default now()
);

-- The live connection behind an Outlook (later Gmail) email channel. Worker-only.
create table public.mail_connections (
  channel_id uuid primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  provider text not null check (provider in ('outlook', 'gmail')),
  account text not null,                                   -- who signed in
  mailbox text not null,                                   -- whose mail is read: the account itself or a shared mailbox
  refresh_secret_id uuid not null,
  subscription_id text,
  subscription_expires timestamptz,
  client_state text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  delta_link text,
  last_sync_at timestamptz,
  problem text,                                            -- plain-words reason when the connection broke
  created_at timestamptz not null default now(),
  foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade
);
create unique index mail_connections_subscription_idx on public.mail_connections (subscription_id) where subscription_id is not null;

alter table public.oauth_pending enable row level security;
alter table public.mail_connections enable row level security;
-- No policies: nobody reads these directly. The app sees the channel; the worker uses the service role.
revoke all on public.oauth_pending, public.mail_connections from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Connecting (runs as the signed-in owner or admin)
-- ---------------------------------------------------------------------------

-- Called from the sign-in callback with Microsoft's refresh token. Returns a short-lived pending id.
create function public.start_mail_connection(p_workspace uuid, p_provider text, p_account text, p_refresh_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  pending uuid;
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if coalesce(length(p_refresh_token), 0) < 20 then raise exception 'no_token' using errcode = '22023'; end if;
  delete from public.oauth_pending where created_at < now() - interval '15 minutes';
  insert into public.oauth_pending (workspace_id, member_id, provider, account, refresh_secret_id)
  values (p_workspace, public.member_id(p_workspace), p_provider, lower(btrim(p_account)),
          vault.create_secret(p_refresh_token, p_provider || '_refresh_' || gen_random_uuid(), p_provider || ' refresh token'))
  returning id into pending;
  return pending;
end $$;

-- Who signed in, so the mailbox picker can offer "your own mailbox". Only for the person who signed in.
create function public.pending_mail_account(p_pending uuid)
returns text language sql stable security definer set search_path = '' as $$
  select p.account from public.oauth_pending p
  where p.id = p_pending and p.member_id = public.member_id(p.workspace_id) and p.created_at > now() - interval '15 minutes'
$$;

-- Turns a pending sign-in into an email channel for the chosen mailbox, and asks the worker to start listening.
create function public.finish_outlook_channel(p_pending uuid, p_mailbox text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  p public.oauth_pending%rowtype;
  box text := lower(btrim(coalesce(p_mailbox, '')));
  ch uuid;
  default_team uuid;
begin
  select * into p from public.oauth_pending where id = p_pending for update;
  if not found or p.created_at < now() - interval '15 minutes' or p.member_id is distinct from public.member_id(p.workspace_id) then
    raise exception 'expired' using errcode = 'P0002';
  end if;
  if not public.has_permission(p.workspace_id, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if box !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_address' using errcode = '22023'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 80 then raise exception 'need_name' using errcode = '22023'; end if;
  if exists (select 1 from public.channels where type = 'email' and external_id = 'outlook:' || box) then
    raise exception 'already_connected' using errcode = '23505';
  end if;

  select id into default_team from public.teams where workspace_id = p.workspace_id and is_default;
  insert into public.channels (workspace_id, type, name, external_id, team_id, settings, connected_by)
  values (p.workspace_id, 'email', btrim(p_name), 'outlook:' || box, default_team,
          -- Outlook sends as the mailbox itself, so there's no domain to verify.
          jsonb_build_object('provider', 'outlook', 'address', box, 'account', p.account, 'domainVerified', true),
          p.member_id)
  returning id into ch;
  insert into public.mail_connections (channel_id, workspace_id, provider, account, mailbox, refresh_secret_id)
  values (ch, p.workspace_id, 'outlook', p.account, box, p.refresh_secret_id);
  delete from public.oauth_pending where id = p.id;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p.workspace_id, p.member_id, 'connect', 'channels', ch::text, jsonb_build_object('type', 'email', 'provider', 'outlook', 'mailbox', box));
  perform public.enqueue_job('mail_subscribe', jsonb_build_object('channel_id', ch), 5::smallint);
  return ch;
end $$;

-- ---------------------------------------------------------------------------
-- The worker's side (service role only)
-- ---------------------------------------------------------------------------

create function public.mail_connection(p_channel uuid)
returns table (channel_id uuid, workspace_id uuid, provider text, mailbox text, refresh_token text, subscription_id text,
               subscription_expires timestamptz, client_state text, delta_link text, channel_status text)
language sql stable security definer set search_path = '' as $$
  select m.channel_id, m.workspace_id, m.provider, m.mailbox, s.decrypted_secret, m.subscription_id, m.subscription_expires,
         m.client_state, m.delta_link, c.status
  from public.mail_connections m
  join public.channels c on c.id = m.channel_id
  join vault.decrypted_secrets s on s.id = m.refresh_secret_id
  where m.channel_id = p_channel
$$;

-- Microsoft rotates refresh tokens: keep the newest.
create function public.save_mail_refresh_token(p_channel uuid, p_token text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  old uuid;
begin
  select refresh_secret_id into old from public.mail_connections where channel_id = p_channel for update;
  if old is null then return; end if;
  update public.mail_connections
     set refresh_secret_id = vault.create_secret(p_token, 'mail_refresh_' || p_channel || '_' || extract(epoch from now())::bigint, 'mail refresh token')
   where channel_id = p_channel;
  delete from vault.secrets where id = old;
end $$;

create function public.set_mail_subscription(p_channel uuid, p_subscription text, p_expires timestamptz)
returns void language sql security definer set search_path = '' as $$
  update public.mail_connections set subscription_id = p_subscription, subscription_expires = p_expires, problem = null where channel_id = p_channel;
  update public.channels set status = 'connected' where id = p_channel and status <> 'connected';
$$;

create function public.set_mail_delta(p_channel uuid, p_delta text)
returns void language sql security definer set search_path = '' as $$
  update public.mail_connections set delta_link = p_delta, last_sync_at = now() where channel_id = p_channel
$$;

-- The connection broke (access revoked, password changed, mailbox gone): show "Reconnect", keep the history.
create function public.mark_mail_broken(p_channel uuid, p_problem text)
returns void language sql security definer set search_path = '' as $$
  update public.mail_connections set problem = left(p_problem, 500) where channel_id = p_channel;
  update public.channels set status = 'disconnected' where id = p_channel;
$$;

-- A push notification names a subscription and echoes our secret: which channel is it, if the secret matches?
create function public.mail_subscription_channel(p_subscription text, p_client_state text)
returns uuid language sql stable security definer set search_path = '' as $$
  select channel_id from public.mail_connections where subscription_id = p_subscription and client_state = p_client_state
$$;

-- Every few minutes: connections whose subscription needs renewing, or that haven't been checked lately.
create function public.mail_connections_due()
returns table (channel_id uuid, renew boolean)
language sql stable security definer set search_path = '' as $$
  select m.channel_id, (m.subscription_expires is null or m.subscription_expires < now() + interval '12 hours')
  from public.mail_connections m join public.channels c on c.id = m.channel_id
  where c.status = 'connected'
    and (m.subscription_expires is null or m.subscription_expires < now() + interval '12 hours'
         or m.last_sync_at is null or m.last_sync_at < now() - interval '5 minutes')
$$;

revoke execute on function public.start_mail_connection(uuid, text, text, text), public.pending_mail_account(uuid),
  public.finish_outlook_channel(uuid, text, text), public.mail_connection(uuid), public.save_mail_refresh_token(uuid, text),
  public.set_mail_subscription(uuid, text, timestamptz), public.set_mail_delta(uuid, text), public.mark_mail_broken(uuid, text),
  public.mail_subscription_channel(text, text), public.mail_connections_due()
  from public, anon;
revoke execute on function public.mail_connection(uuid), public.save_mail_refresh_token(uuid, text), public.set_mail_subscription(uuid, text, timestamptz),
  public.set_mail_delta(uuid, text), public.mark_mail_broken(uuid, text), public.mail_subscription_channel(text, text), public.mail_connections_due()
  from authenticated;
grant execute on function public.start_mail_connection(uuid, text, text, text), public.pending_mail_account(uuid), public.finish_outlook_channel(uuid, text, text)
  to authenticated;
