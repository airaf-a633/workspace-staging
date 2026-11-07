-- Fixes from the correctness review of the 4-8 November migrations (2026-11-05). Each is a replacement of a function from an earlier,
-- not-yet-applied migration, kept here so the history says what changed and why.

-- 1. The invite-code check no longer reveals who has a pending workspace invitation, and is no longer open to anyone with the public key.
--    The sign-up page asks through the server (service role). The database gate (the trigger on auth.users) is unchanged and still decides.
create or replace function public.signup_allowed(p_email text, p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from public.app_settings where key = 'invite_only'), 'on') <> 'on'
      or exists (
        select 1 from public.pilot_invites p
         where p.code = public.normalise_invite_code(p_code)
           and p.revoked_at is null and (p.expires_at is null or p.expires_at > now()) and p.uses < p.max_uses
      )
$$;
revoke execute on function public.signup_allowed(text, text) from public, anon, authenticated;
grant execute on function public.signup_allowed(text, text) to service_role;

-- Someone who opened a workspace invitation link holds its secret token, so they may ask whether the address they are signing up with
-- is the one invited. (Without the token, nothing is revealed.)
create function public.invite_email_matches(p_token text, p_email text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.invites i
     where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
       and i.accepted_at is null and i.expires_at > now()
       and i.email = lower(btrim(coalesce(p_email, '')))
  )
$$;
revoke execute on function public.invite_email_matches(text, text) from public, anon, authenticated;
grant execute on function public.invite_email_matches(text, text) to service_role;

-- 2. One failing reply-target sweep must not stop late-task notices and the 30-day cleanup: it runs in its own sub-transaction.
create or replace function public.sweep_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.notifications (workspace_id, member_id, kind, subject, contact_id, deal_id, task_id, dedupe_key)
  select t.workspace_id, t.owner_member_id, 'task_late', left(t.text, 200), t.contact_id, t.deal_id, t.id, 'late:' || t.id || ':' || extract(epoch from t.due_at)::bigint
    from public.tasks t
    join public.members m on m.id = t.owner_member_id and m.status = 'active'
   where t.done_at is null and t.due_at is not null
     and case when t.has_time then t.due_at < now() else t.due_at + interval '1 day' < now() end
     and t.due_at > now() - interval '30 days'
  on conflict (member_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count;
  begin
    n := n + public.sweep_sla();
  exception when others then
    raise warning 'sweep_sla failed: %', sqlerrm;
  end;
  delete from public.notifications where created_at < now() - interval '30 days';
  return n;
end $$;

-- 3. Messages on a chat marked spam do not start a clock; marking it "not spam" starts it clean, like a resolved chat coming back.
create or replace function public.sla_on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.imported then return new; end if;
  if new.direction = 'in' then
    update public.conversations
       set sla_owed_since = coalesce(sla_owed_since, new.sent_at), sla_chat_started = coalesce(sla_chat_started, new.sent_at)
     where id = new.conversation_id and not imported and status <> 'spam';
  elsif new.source in ('inbox', 'phone_app', 'channel_app') and new.status is distinct from 'failed' then
    update public.conversations
       set sla_waited = sla_waited + case when sla_owed_since is not null then public.business_minutes(workspace_id, team_id, sla_owed_since, new.sent_at) else 0 end,
           sla_owed_since = null, sla_answered = true
     where id = new.conversation_id and not imported and status <> 'spam';
  end if;
  return new;
end $$;
create trigger conversations_sla_unspam before update of status on public.conversations for each row
  when (old.status = 'spam' and new.status = 'open')
  execute function public.sla_reset();

-- 4. Rebuilding a chat's facts holds the chat's row first, so a message that arrives at the same moment is not overwritten.
create or replace function public.sla_rebuild(p_conversation uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  c public.conversations;
  since timestamptz;
  m record;
  owed timestamptz;
  started timestamptz;
  answered boolean := false;
  waited numeric := 0;
begin
  select * into c from public.conversations where id = p_conversation for update;
  if not found then return; end if;
  if not c.imported and c.status = 'open' then
    select max(e.created_at) into since from public.conversation_events e where e.conversation_id = p_conversation and e.kind in ('resolved', 'spam');
    for m in
      select x.direction, x.source, x.status, x.sent_at from public.messages x
       where x.conversation_id = p_conversation and not x.imported and (since is null or x.sent_at > since)
       order by x.sent_at
    loop
      if m.direction = 'in' then
        owed := coalesce(owed, m.sent_at);
        started := coalesce(started, m.sent_at);
      elsif m.source in ('inbox', 'phone_app', 'channel_app') and m.status is distinct from 'failed' then
        if owed is not null then waited := waited + public.business_minutes(c.workspace_id, c.team_id, owed, m.sent_at); owed := null; end if;
        answered := true;
      end if;
    end loop;
  end if;
  update public.conversations set sla_owed_since = owed, sla_chat_started = started, sla_answered = answered, sla_waited = waited where id = p_conversation;
end $$;

-- 5. Faster clocks: the time a chat has waited is worked out once per chat, not once per target, and a person's clocks are only worked
--    out for the chats they may see (instead of every open chat in the workspace, then filtered).
create or replace function public.sla_state(p_workspace uuid, p_conversations uuid[] default null)
returns table (conversation_id uuid, target text, used numeric, limit_min int, state text, running boolean, policy text, anchor timestamptz)
language sql stable security definer set search_path = '' as $$
  with ws as (select w.sla_warn_at as warn from public.workspaces w where w.id = p_workspace),
  convs as (
    select c.id, c.workspace_id, c.team_id, c.sla_owed_since as owed, c.sla_chat_started as started, c.sla_answered as answered, c.sla_waited as waited,
           ch.type as channel, public.contact_is_vip(c.contact_id) as vip,
           case when c.sla_owed_since is not null then public.business_minutes(c.workspace_id, c.team_id, c.sla_owed_since, now()) else 0 end as span
      from public.conversations c join public.channels ch on ch.id = c.channel_id
     where c.workspace_id = p_workspace and c.status = 'open' and not c.imported and c.sla_chat_started is not null
       and (p_conversations is null or c.id = any (p_conversations))
  ),
  wanted as (
    select c.*, k.target from convs c
    cross join lateral (values ('first_reply'), ('next_reply'), ('resolution')) k(target)
    where k.target = 'resolution' or (c.owed is not null and ((k.target = 'first_reply') <> c.answered))
  ),
  picked as (
    select w.*, p.limit_min as lim, p.policy as pol
      from wanted w cross join lateral public.sla_pick(w.workspace_id, w.team_id, w.channel, w.vip, w.target) p
  ),
  timed as (
    select p.*, case when p.target = 'resolution' then p.waited else 0 end + p.span as spent from picked p
  )
  select t.id, t.target, round(t.spent, 2), t.lim,
         case when t.spent >= t.lim then 'breach' when t.spent >= t.lim * (select ws.warn from ws) then 'warn' else 'ok' end,
         t.owed is not null, t.pol,
         case when t.target = 'resolution' then t.started else t.owed end
    from timed t
$$;

create or replace function public.sla_clocks(p_workspace uuid)
returns table (conversation_id uuid, target text, used numeric, limit_min int, state text, running boolean, policy text, anchor timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare visible uuid[];
begin
  if not public.is_member(p_workspace) then return; end if;
  select coalesce(array_agg(c.id), '{}') into visible
    from public.conversations c
   where c.workspace_id = p_workspace and c.status = 'open' and not c.imported and c.sla_chat_started is not null
     and public.covers_conversation(c.id, 'conversations.view');
  return query
    select s.conversation_id, s.target, s.used, s.limit_min, s.state, s.running, s.policy, s.anchor
      from public.sla_state(p_workspace, visible) s;
end $$;

-- 6. A missing kind gets the same plain refusal as a wrong one (a null slipped past "not in" and failed on the table instead).
create or replace function public.send_feedback(p_workspace uuid, p_kind text, p_body text, p_page text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.member_id(p_workspace);
  body text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind is null or p_kind not in ('broken', 'confusing', 'wish', 'other') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if length(body) not between 1 and 4000 then raise exception 'bad_body' using errcode = '22023'; end if;
  if (select count(*) from public.pilot_feedback f where f.member_id = me and f.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  insert into public.pilot_feedback (workspace_id, member_id, kind, body, page)
  values (p_workspace, me, p_kind, body, left(nullif(btrim(coalesce(p_page, '')), ''), 200));
end $$;
