-- Reply targets (SLA) on real data (decided 2026-11-03). See docs/PRODUCT_DECISIONS.md "Reply targets (SLA) on real data".
--
--   Hours are per team: weekly opening hours plus a list of closed days or special hours (holidays, Ramadan, closures).
--   Rules ("policies") match by team, channel and VIP (a customer tagged "VIP"); the strictest target wins, per target.
--   Each open chat keeps three small facts, kept up to date by triggers on messages and on the chat's status:
--     sla_owed_since    when the customer began waiting for a person's reply (empty when nobody is waiting)
--     sla_answered      a person has replied in this chat
--     sla_waited        business minutes the customer has already waited, in waits that ended
--     sla_chat_started  when the customer first wrote in this chat
--   A reply from a person (inbox, the business's phone app, or typed in the channel's own app) ends a wait. Automatic, AI
--   and failed messages do not; a send that fails starts the clock again. Resolving a chat, or marking it spam, resets it.
--   Clocks only count minutes inside the team's opening hours (workspace time zone).
--   The clock for a chat is read from those facts by sla_state(); the worker's sweep turns warn and breach into notices.

-- ---------------------------------------------------------------------------
-- Hours, closed days, rules, and two workspace settings
-- ---------------------------------------------------------------------------

create table public.team_hours (
  workspace_id uuid not null,
  team_id uuid not null,
  weekday int not null check (weekday between 0 and 6),            -- 0 = Monday
  opens int not null check (opens between 0 and 1439),             -- minutes after midnight
  closes int not null check (closes between 1 and 1440),
  primary key (team_id, weekday),
  check (closes > opens),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);

-- A date or a run of dates that is closed (opens and closes empty) or has its own hours.
create table public.team_closures (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  team_id uuid not null,
  from_date date not null,
  to_date date not null,
  opens int check (opens between 0 and 1439),
  closes int check (closes between 1 and 1440),
  label text check (label is null or length(label) <= 60),
  created_at timestamptz not null default now(),
  check (to_date >= from_date and to_date - from_date < 366),
  check ((opens is null) = (closes is null)),
  check (opens is null or closes > opens),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade
);
create index team_closures_team on public.team_closures (team_id, from_date);

create table public.sla_policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 50),
  active boolean not null default true,
  -- Empty means "any". A team that is later deleted simply stops matching.
  team_ids uuid[] not null default '{}' check (cardinality(team_ids) <= 50),
  channel_types text[] not null default '{}' check (cardinality(channel_types) <= 30),
  vip boolean not null default false,
  -- Minutes of opening hours; empty means this rule sets no such target.
  first_reply_min int check (first_reply_min between 1 and 43200),
  next_reply_min int check (next_reply_min between 1 and 43200),
  resolution_min int check (resolution_min between 1 and 43200),
  created_at timestamptz not null default now(),
  check (first_reply_min is not null or next_reply_min is not null or resolution_min is not null)
);
create index sla_policies_workspace on public.sla_policies (workspace_id);

-- Warn at half, 80% or 90% of a target; whether a team's managers hear about a miss.
alter table public.workspaces
  add column sla_warn_at numeric(3, 2) not null default 0.80 check (sla_warn_at in (0.50, 0.80, 0.90)),
  add column sla_alert_managers boolean not null default true;

alter table public.team_hours enable row level security;
alter table public.team_closures enable row level security;
alter table public.sla_policies enable row level security;
create policy team_hours_read on public.team_hours for select to authenticated using ((select public.is_member(workspace_id)));
create policy team_closures_read on public.team_closures for select to authenticated using ((select public.is_member(workspace_id)));
create policy sla_policies_read on public.sla_policies for select to authenticated using ((select public.is_member(workspace_id)));
revoke all on public.team_hours, public.team_closures, public.sla_policies from anon;
revoke insert, update, delete, truncate on public.team_hours, public.team_closures, public.sla_policies from authenticated;

-- A new team opens Monday to Friday, 9 to 17, until its manager changes it.
create function public.teams_seed_hours() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.team_hours (workspace_id, team_id, weekday, opens, closes)
  select new.workspace_id, new.id, d, 540, 1020 from generate_series(0, 4) d;
  return new;
end $$;
create trigger teams_seed_hours after insert on public.teams for each row execute function public.teams_seed_hours();

insert into public.team_hours (workspace_id, team_id, weekday, opens, closes)
select t.workspace_id, t.id, d, 540, 1020 from public.teams t cross join generate_series(0, 4) d;

-- ---------------------------------------------------------------------------
-- Business minutes, and which rule applies
-- ---------------------------------------------------------------------------

-- Minutes between two moments that fall inside the team's opening hours, in the workspace's time zone. A closed day counts
-- nothing, a day with special hours uses those. A chat without a team uses the default team's hours. Looks back at most 400 days.
create function public.business_minutes(p_workspace uuid, p_team uuid, p_from timestamptz, p_to timestamptz)
returns numeric language plpgsql stable security definer set search_path = '' as $$
declare
  tz text;
  t uuid;
  d0 date;
  d1 date;
begin
  if p_from is null or p_to is null or p_to <= p_from then return 0; end if;
  select w.timezone into tz from public.workspaces w where w.id = p_workspace;
  t := coalesce(p_team, (select x.id from public.teams x where x.workspace_id = p_workspace and x.is_default));
  if tz is null or t is null then return 0; end if;
  d0 := (p_from at time zone tz)::date;
  d1 := (p_to at time zone tz)::date;
  if d1 - d0 > 400 then d0 := d1 - 400; end if;
  return coalesce((
    select sum(extract(epoch from greatest(interval '0', least(win.e, p_to) - greatest(win.s, p_from)))) / 60.0
      from generate_series(0, d1 - d0) i
      cross join lateral (select d0 + i as day) g
      left join lateral (select x.id, x.opens, x.closes from public.team_closures x where x.team_id = t and g.day between x.from_date and x.to_date order by x.created_at desc limit 1) ex on true
      left join lateral (select h.opens, h.closes from public.team_hours h where h.team_id = t and h.weekday = extract(isodow from g.day)::int - 1) wk on true
      cross join lateral (select case when ex.id is not null then ex.opens else wk.opens end as o,
                                 case when ex.id is not null then ex.closes else wk.closes end as c) w
      cross join lateral (select (g.day::timestamp + make_interval(mins => w.o)) at time zone tz as s,
                                 (g.day::timestamp + make_interval(mins => w.c)) at time zone tz as e) win
     where w.o is not null
  ), 0);
end $$;

create function public.contact_is_vip(p_contact uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.contacts c cross join lateral unnest(c.tags) t where c.id = p_contact and lower(btrim(t)) = 'vip')
$$;

-- The strictest target of one kind among the active rules that match, with the rule it came from.
create function public.sla_pick(p_workspace uuid, p_team uuid, p_channel text, p_vip boolean, p_target text)
returns table (limit_min int, policy text)
language sql stable security definer set search_path = '' as $$
  select v.lim, p.name
    from public.sla_policies p
    cross join lateral (select case p_target when 'first_reply' then p.first_reply_min when 'next_reply' then p.next_reply_min else p.resolution_min end as lim) v
   where p.workspace_id = p_workspace and p.active and v.lim is not null
     and (cardinality(p.team_ids) = 0 or p_team = any (p.team_ids))
     and (cardinality(p.channel_types) = 0 or p_channel = any (p.channel_types))
     and (not p.vip or p_vip)
   order by v.lim, p.name
   limit 1
$$;

-- ---------------------------------------------------------------------------
-- What each chat remembers, kept up to date as messages arrive
-- ---------------------------------------------------------------------------

alter table public.conversations
  add column sla_owed_since timestamptz,
  add column sla_chat_started timestamptz,
  add column sla_answered boolean not null default false,
  add column sla_waited numeric not null default 0;

-- A customer's message starts a wait if none is running; a person's reply ends it and adds it to the chat's total.
create function public.sla_on_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.imported then return new; end if;
  if new.direction = 'in' then
    update public.conversations
       set sla_owed_since = coalesce(sla_owed_since, new.sent_at), sla_chat_started = coalesce(sla_chat_started, new.sent_at)
     where id = new.conversation_id and not imported;
  elsif new.source in ('inbox', 'phone_app', 'channel_app') and new.status is distinct from 'failed' then
    update public.conversations
       set sla_waited = sla_waited + case when sla_owed_since is not null then public.business_minutes(workspace_id, team_id, sla_owed_since, new.sent_at) else 0 end,
           sla_owed_since = null, sla_answered = true
     where id = new.conversation_id and not imported;
  end if;
  return new;
end $$;
create trigger messages_sla after insert on public.messages for each row execute function public.sla_on_message();

-- Replays the chat from its last resolve (or spam mark) to rebuild the four facts. Used for chats that were already open
-- when this migration ran, and when a reply turns out to have failed.
create function public.sla_rebuild(p_conversation uuid) returns void
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
  select * into c from public.conversations where id = p_conversation;
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

create function public.sla_on_failed() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.sla_rebuild(new.conversation_id);
  return new;
end $$;
create trigger messages_sla_failed after update of status on public.messages for each row
  when (new.status = 'failed' and old.status is distinct from 'failed' and new.direction = 'out')
  execute function public.sla_on_failed();

-- Resolving, or marking spam, ends the chat: the next message from the customer starts a new one.
create function public.sla_reset() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.sla_owed_since := null; new.sla_chat_started := null; new.sla_answered := false; new.sla_waited := 0;
  return new;
end $$;
create trigger conversations_sla_reset before update of status on public.conversations for each row
  when (old.status = 'open' and new.status <> 'open')
  execute function public.sla_reset();

select public.sla_rebuild(c.id) from public.conversations c where c.status = 'open' and not c.imported;

-- ---------------------------------------------------------------------------
-- The clocks
-- ---------------------------------------------------------------------------

-- One row per running clock on an open chat: used and limit are minutes of opening hours. state is ok, warn (at the workspace's
-- share of the target) or breach (at the target). A reply clock runs while a reply is owed: first reply until a person has
-- answered, then next reply. The resolution clock adds up every wait in the chat, so it keeps its state while the team waits
-- on the customer (running is false then). anchor names the wait (or, for resolution, the chat) the clock belongs to.
create function public.sla_state(p_workspace uuid, p_conversations uuid[] default null)
returns table (conversation_id uuid, target text, used numeric, limit_min int, state text, running boolean, policy text, anchor timestamptz)
language sql stable security definer set search_path = '' as $$
  with ws as (select w.sla_warn_at as warn from public.workspaces w where w.id = p_workspace),
  convs as (
    select c.id, c.workspace_id, c.team_id, c.sla_owed_since as owed, c.sla_chat_started as started, c.sla_answered as answered, c.sla_waited as waited,
           ch.type as channel, public.contact_is_vip(c.contact_id) as vip
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
    select p.*,
           case when p.target = 'resolution' then p.waited else 0 end
             + case when p.owed is not null then public.business_minutes(p.workspace_id, p.team_id, p.owed, now()) else 0 end as spent
      from picked p
  )
  select t.id, t.target, round(t.spent, 2), t.lim,
         case when t.spent >= t.lim then 'breach' when t.spent >= t.lim * (select ws.warn from ws) then 'warn' else 'ok' end,
         t.owed is not null, t.pol,
         case when t.target = 'resolution' then t.started else t.owed end
    from timed t
$$;

-- What the signed-in person may see: the clocks of the chats they can see.
create function public.sla_clocks(p_workspace uuid)
returns table (conversation_id uuid, target text, used numeric, limit_min int, state text, running boolean, policy text, anchor timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_member(p_workspace) then return; end if;
  return query
    select s.conversation_id, s.target, s.used, s.limit_min, s.state, s.running, s.policy, s.anchor
      from public.sla_state(p_workspace, null) s
     where public.covers_conversation(s.conversation_id, 'conversations.view');
end $$;

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------

alter table public.notifications add column sla_target text check (sla_target in ('first_reply', 'next_reply', 'resolution'));
alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check
  check (kind in ('handover', 'mention', 'collab_request', 'channel_broken', 'discount_asked', 'discount_approved', 'discount_declined', 'task_assigned', 'task_late', 'sla_warn', 'sla_breach'));

-- A warning goes to whoever holds the chat. A breach goes to the holder and, if the workspace wants it, to the team's managers
-- (the owner and anyone who may manage that team); a breach on a chat nobody holds goes to the people on that team who can
-- reply, and to its managers. Once per wait (per chat for resolution) and level. Nothing ever moves a chat.
create function public.sweep_sla() returns int
language plpgsql security definer set search_path = '' as $$
declare
  w record;
  n int := 0;
  k int;
begin
  for w in select distinct p.workspace_id, ws.sla_alert_managers as managers from public.sla_policies p join public.workspaces ws on ws.id = p.workspace_id where p.active loop
    insert into public.notifications (workspace_id, member_id, kind, subject, contact_id, conversation_id, sla_target, dedupe_key)
    select w.workspace_id, r.member_id, 'sla_' || r.level, left(r.label, 200), r.contact_id, r.conversation_id, r.target,
           'sla:' || r.conversation_id || ':' || r.target || ':' || r.level || ':' || extract(epoch from r.anchor)::bigint
      from (
        select s.conversation_id, s.target, s.state as level, s.anchor, c.holder_member_id, c.team_id, c.contact_id,
               coalesce(ct.name, ct.profile_name, ct.email, ct.phone, 'Website visitor') as label,
               m.id as member_id
          from public.sla_state(w.workspace_id, null) s
          join public.conversations c on c.id = s.conversation_id
          join public.contacts ct on ct.id = c.contact_id
          join public.members m on m.workspace_id = w.workspace_id and m.status = 'active'
         where s.state in ('warn', 'breach')
           and (
             m.id = c.holder_member_id
             or (s.state = 'breach' and w.managers and public.member_in_scope(m.id, 'teams.manage', c.team_id, null))
             or (s.state = 'breach' and c.holder_member_id is null and c.team_id is not null
                 and public.member_scope(m.id, 'conversations.reply') <> 'none'
                 and exists (select 1 from public.team_members tm where tm.team_id = c.team_id and tm.member_id = m.id))
           )
           and public.member_covers_conversation(m.id, c.id, 'conversations.view')
      ) r
    on conflict (member_id, dedupe_key) where dedupe_key is not null do nothing;
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  -- A notice stops waiting once the chat is resolved, or (for a reply clock) once a person has answered.
  update public.notifications nt set read_at = now()
   where nt.kind in ('sla_warn', 'sla_breach') and nt.read_at is null
     and exists (select 1 from public.conversations c where c.id = nt.conversation_id
                   and (c.status <> 'open' or (nt.sla_target <> 'resolution' and c.sla_owed_since is null)));
  return n;
end $$;

-- The worker already runs this every few minutes; it now also runs the reply-target sweep.
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
  n := n + public.sweep_sla();
  delete from public.notifications where created_at < now() - interval '30 days';
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Editing: hours, closed days, rules, alerts
-- ---------------------------------------------------------------------------

-- May the caller change this team's hours? Everyone with "all", or with "team" if they are on the team.
create function public.can_manage_team(p_workspace uuid, p_team uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.teams t where t.id = p_team and t.workspace_id = p_workspace)
     and case public.permission_scope(p_workspace, 'teams.manage')
           when 'all' then true
           when 'team' then public.in_team(p_workspace, p_team)
           else false
         end
$$;

create function public.sla_audit(p_workspace uuid, p_action text, p_entity text, p_id uuid, p_data jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), p_action, p_entity, p_id::text, p_data)
$$;

-- Seven entries, Monday first: null for a closed day, or {"opens": minutes, "closes": minutes} after midnight.
create function public.save_team_hours(p_team uuid, p_hours jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  i int;
  d jsonb;
  o int;
  c int;
begin
  select t.workspace_id into ws from public.teams t where t.id = p_team;
  if ws is null or not public.can_manage_team(ws, p_team) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_typeof(p_hours) is distinct from 'array' or jsonb_array_length(p_hours) <> 7 then raise exception 'bad_hours' using errcode = '22023'; end if;
  for i in 0..6 loop
    d := p_hours -> i;
    if jsonb_typeof(d) = 'object' then
      o := (d ->> 'opens')::int; c := (d ->> 'closes')::int;
      if o is null or c is null or o < 0 or o > 1439 or c < 1 or c > 1440 or c <= o then raise exception 'bad_hours' using errcode = '22023'; end if;
    elsif jsonb_typeof(d) is distinct from 'null' then
      raise exception 'bad_hours' using errcode = '22023';
    end if;
  end loop;
  delete from public.team_hours where team_id = p_team;
  for i in 0..6 loop
    d := p_hours -> i;
    if jsonb_typeof(d) = 'object' then
      insert into public.team_hours (workspace_id, team_id, weekday, opens, closes) values (ws, p_team, i, (d ->> 'opens')::int, (d ->> 'closes')::int);
    end if;
  end loop;
  perform public.sla_audit(ws, 'update', 'team_hours', p_team, p_hours);
end $$;

-- A date or run of dates that is closed (no opens/closes) or has other hours. Two for the same team cannot overlap.
create function public.add_team_closure(p_team uuid, p_from date, p_to date, p_opens int default null, p_closes int default null, p_label text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  new_id uuid;
begin
  select t.workspace_id into ws from public.teams t where t.id = p_team;
  if ws is null or not public.can_manage_team(ws, p_team) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from >= 366 then raise exception 'bad_dates' using errcode = '22023'; end if;
  if (p_opens is null) <> (p_closes is null) or (p_opens is not null and (p_opens < 0 or p_opens > 1439 or p_closes < 1 or p_closes > 1440 or p_closes <= p_opens)) then
    raise exception 'bad_hours' using errcode = '22023';
  end if;
  if exists (select 1 from public.team_closures x where x.team_id = p_team and x.from_date <= p_to and x.to_date >= p_from) then
    raise exception 'overlap' using errcode = 'P0001';
  end if;
  insert into public.team_closures (workspace_id, team_id, from_date, to_date, opens, closes, label)
  values (ws, p_team, p_from, p_to, p_opens, p_closes, left(nullif(btrim(coalesce(p_label, '')), ''), 60))
  returning team_closures.id into new_id;
  perform public.sla_audit(ws, 'create', 'team_closures', new_id, jsonb_build_object('team', p_team, 'from', p_from, 'to', p_to));
  return new_id;
end $$;

create function public.remove_team_closure(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare x public.team_closures;
begin
  select * into x from public.team_closures where id = p_id;
  if not found or not public.can_manage_team(x.workspace_id, x.team_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.team_closures where id = p_id;
  perform public.sla_audit(x.workspace_id, 'delete', 'team_closures', p_id, jsonb_build_object('team', x.team_id));
end $$;

-- May the caller change a rule that names these teams? "All" changes any rule, including one for every team. "Team" only a
-- rule that names teams, every one of them a team they are on.
create function public.can_edit_policy(p_workspace uuid, p_teams uuid[]) returns boolean
language sql stable security definer set search_path = '' as $$
  select case public.permission_scope(p_workspace, 'teams.manage')
           when 'all' then true
           when 'team' then cardinality(p_teams) > 0 and not exists (select 1 from unnest(p_teams) t where not public.in_team(p_workspace, t))
           else false
         end
$$;

-- Creates a rule (p_id empty) or changes one. Targets are minutes of opening hours; leave a target empty to set none.
create function public.save_sla_policy(
  p_workspace uuid, p_id uuid, p_name text, p_active boolean, p_teams uuid[], p_channels text[], p_vip boolean,
  p_first int, p_next int, p_resolution int
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  teams uuid[] := coalesce((select array_agg(distinct t) from unnest(coalesce(p_teams, '{}')) t), '{}');
  chans text[] := coalesce((select array_agg(distinct lower(btrim(c))) from unnest(coalesce(p_channels, '{}')) c), '{}');
  prev public.sla_policies;
  pid uuid;
begin
  if not public.is_member(p_workspace) or not public.can_edit_policy(p_workspace, teams) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_id is not null then
    select * into prev from public.sla_policies where id = p_id and workspace_id = p_workspace;
    if not found or not public.can_edit_policy(p_workspace, prev.team_ids) then raise exception 'not_allowed' using errcode = '42501'; end if;
  end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 50 then raise exception 'bad_name' using errcode = '22023'; end if;
  if (select count(*) from public.teams t where t.workspace_id = p_workspace and t.id = any (teams)) <> cardinality(teams) then raise exception 'bad_team' using errcode = '22023'; end if;
  if exists (select 1 from unnest(chans) c where c !~ '^[a-z_]{1,20}$') then raise exception 'bad_channel' using errcode = '22023'; end if;
  if (p_first is null and p_next is null and p_resolution is null)
     or coalesce(p_first, 1) not between 1 and 43200 or coalesce(p_next, 1) not between 1 and 43200 or coalesce(p_resolution, 1) not between 1 and 43200 then
    raise exception 'bad_targets' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.sla_policies (workspace_id, name, active, team_ids, channel_types, vip, first_reply_min, next_reply_min, resolution_min)
    values (p_workspace, btrim(p_name), coalesce(p_active, true), teams, chans, coalesce(p_vip, false), p_first, p_next, p_resolution)
    returning sla_policies.id into pid;
  else
    update public.sla_policies set name = btrim(p_name), active = coalesce(p_active, true), team_ids = teams, channel_types = chans, vip = coalesce(p_vip, false),
           first_reply_min = p_first, next_reply_min = p_next, resolution_min = p_resolution
     where id = p_id;
    pid := p_id;
  end if;
  perform public.sla_audit(p_workspace, case when p_id is null then 'create' else 'update' end, 'sla_policies', pid, jsonb_build_object('name', btrim(p_name)));
  return pid;
end $$;

create function public.delete_sla_policy(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare prev public.sla_policies;
begin
  select * into prev from public.sla_policies where id = p_id;
  if not found or not public.can_edit_policy(prev.workspace_id, prev.team_ids) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.sla_policies where id = p_id;
  perform public.sla_audit(prev.workspace_id, 'delete', 'sla_policies', p_id, jsonb_build_object('name', prev.name));
end $$;

-- The two workspace settings: when to warn, and whether a team's managers hear about a miss. Whoever manages every team.
create function public.set_sla_alerts(p_workspace uuid, p_warn numeric, p_managers boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if public.permission_scope(p_workspace, 'teams.manage') <> 'all' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_warn not in (0.50, 0.80, 0.90) then raise exception 'bad_warn' using errcode = '22023'; end if;
  update public.workspaces set sla_warn_at = p_warn, sla_alert_managers = coalesce(p_managers, true) where id = p_workspace;
  perform public.sla_audit(p_workspace, 'update', 'workspaces', p_workspace, jsonb_build_object('sla_warn_at', p_warn, 'sla_alert_managers', p_managers));
end $$;

revoke execute on function
  public.teams_seed_hours(), public.business_minutes(uuid, uuid, timestamptz, timestamptz), public.contact_is_vip(uuid),
  public.sla_pick(uuid, uuid, text, boolean, text), public.sla_on_message(), public.sla_rebuild(uuid), public.sla_on_failed(), public.sla_reset(),
  public.sla_state(uuid, uuid[]), public.sweep_sla(), public.can_manage_team(uuid, uuid), public.sla_audit(uuid, text, text, uuid, jsonb),
  public.can_edit_policy(uuid, uuid[]),
  public.sla_clocks(uuid), public.save_team_hours(uuid, jsonb), public.add_team_closure(uuid, date, date, int, int, text), public.remove_team_closure(uuid),
  public.save_sla_policy(uuid, uuid, text, boolean, uuid[], text[], boolean, int, int, int), public.delete_sla_policy(uuid), public.set_sla_alerts(uuid, numeric, boolean)
  from public, anon, authenticated;
grant execute on function
  public.sla_clocks(uuid), public.save_team_hours(uuid, jsonb), public.add_team_closure(uuid, date, date, int, int, text), public.remove_team_closure(uuid),
  public.save_sla_policy(uuid, uuid, text, boolean, uuid[], text[], boolean, int, int, int), public.delete_sla_policy(uuid), public.set_sla_alerts(uuid, numeric, boolean)
  to authenticated;
grant execute on function public.sweep_sla() to service_role;

-- ---------------------------------------------------------------------------
-- Reports: replies typed in a channel's own app now count as a person's reply (they were left out of the first version), and
-- "answered within target" is added.
-- ---------------------------------------------------------------------------

create or replace function public.report_conversations(p_workspace uuid, p_days int, p_tz text, p_team uuid default null, p_channel text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope public.permission_scope := public.permission_scope(p_workspace, 'reports.view');
  me uuid := public.member_id(p_workspace);
  mine uuid[];
  today date;
  win_from timestamptz;
  prev_from timestamptz;
  result jsonb;
begin
  if scope = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_days not in (7, 30, 90) then raise exception 'bad_range' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then raise exception 'bad_zone' using errcode = '22023'; end if;
  select coalesce(array_agg(tm.team_id), '{}') into mine
    from public.team_members tm join public.members m on m.id = tm.member_id
   where tm.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  today := (now() at time zone p_tz)::date;
  win_from := (today - (p_days - 1))::timestamp at time zone p_tz;
  prev_from := (today - (2 * p_days - 1))::timestamp at time zone p_tz;

  with convs as (
    select c.id, c.team_id, ch.type as channel, public.contact_is_vip(c.contact_id) as vip
      from public.conversations c join public.channels ch on ch.id = c.channel_id
     where c.workspace_id = p_workspace and not c.imported and c.status <> 'spam'
       and (scope = 'all' or c.team_id = any (mine) or c.holder_member_id = me)
       and (p_team is null or c.team_id = p_team)
       and (p_channel is null or ch.type = p_channel)
  ),
  ins as (
    select m.conversation_id, m.sent_at,
           lag(m.sent_at) over (partition by m.conversation_id order by m.sent_at) as prev_in
      from public.messages m join convs v on v.id = m.conversation_id
     where m.direction = 'in' and not m.imported
  ),
  flagged as (
    select i.conversation_id, i.sent_at,
           (i.prev_in is null or exists (
              select 1 from public.conversation_events e
               where e.conversation_id = i.conversation_id and e.kind = 'resolved' and e.created_at > i.prev_in and e.created_at < i.sent_at)) as is_start
      from ins i
  ),
  starts as (
    select f.conversation_id, f.sent_at as started_at,
           lead(f.sent_at) over (partition by f.conversation_id order by f.sent_at) as next_start
      from flagged f where f.is_start
  ),
  chats as (
    select s.conversation_id, s.started_at, s.next_start, v.team_id, v.channel, v.vip, r.at as resolved_at, r.who as resolved_by, fr.sent_at as reply_at, fr.who as reply_by
      from starts s
      join convs v on v.id = s.conversation_id
      left join lateral (
        select e.created_at as at, e.actor_member_id as who from public.conversation_events e
         where e.conversation_id = s.conversation_id and e.kind = 'resolved'
           and e.created_at > s.started_at and e.created_at < coalesce(s.next_start, 'infinity'::timestamptz)
         order by e.created_at limit 1) r on true
      left join lateral (
        select o.sent_at, o.sent_by_member as who from public.messages o
         where o.conversation_id = s.conversation_id and o.direction = 'out' and o.source in ('inbox', 'phone_app', 'channel_app')
           and not o.imported and o.status is distinct from 'failed'
           and o.sent_at > s.started_at and o.sent_at < coalesce(r.at, s.next_start, 'infinity'::timestamptz)
         order by o.sent_at limit 1) fr on true
     where s.started_at >= prev_from
  ),
  cur as (select * from chats where started_at >= win_from),
  pairs as (
    select c.conversation_id, c.started_at, o.sent_by_member as member_id
      from cur c
      join public.messages o on o.conversation_id = c.conversation_id and o.direction = 'out' and o.source = 'inbox'
       and o.sent_by_member is not null and not o.imported and o.status is distinct from 'failed'
       and o.sent_at > c.started_at and o.sent_at < coalesce(c.resolved_at, c.next_start, 'infinity'::timestamptz)
     group by c.conversation_id, c.started_at, o.sent_by_member
  ),
  hand as (
    select e.actor_member_id as actor, e.to_member_id as to_member
      from public.conversation_events e join convs v on v.id = e.conversation_id
     where e.kind in ('handed_to_person', 'handed_to_team') and e.created_at >= win_from
  ),
  -- Answered within target: chats the rules gave a first-reply target, where a person answered inside it (counting opening hours),
  -- or nobody answered and the target has already passed. A chat still inside its target, or closed quickly, is not judged.
  firsts as (
    select c.started_at, c.reply_at, c.resolved_at, c.team_id, p.limit_min
      from cur c cross join lateral public.sla_pick(p_workspace, c.team_id, c.channel, c.vip, 'first_reply') p
  ),
  judged as (
    select f.reply_at is not null and public.business_minutes(p_workspace, f.team_id, f.started_at, f.reply_at) <= f.limit_min as ok
      from firsts f
     where f.reply_at is not null
        or public.business_minutes(p_workspace, f.team_id, f.started_at, coalesce(f.resolved_at, now())) > f.limit_min
  ),
  people as (
    select member_id from pairs
    union select reply_by from cur where reply_by is not null
    union select resolved_by from cur where resolved_by is not null
    union select actor from hand where actor is not null
    union select to_member from hand where to_member is not null
  )
  select jsonb_build_object(
    'total', (select count(*) from cur),
    'prevTotal', (select count(*) from chats where started_at < win_from),
    'firstReplySeconds', (select percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) from cur where reply_at is not null),
    'resolutionSeconds', (select percentile_cont(0.5) within group (order by extract(epoch from resolved_at - started_at)) from cur where resolved_at is not null),
    'resolved', (select count(*) from cur where resolved_at is not null),
    'withinTarget', jsonb_build_object('n', (select count(*) from judged), 'ok', (select count(*) from judged where ok)),
    'backlog', (select count(*) from convs v join public.conversations c on c.id = v.id where c.status = 'open'),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', (today - (p_days - 1) + i)::text, 'n', coalesce(x.n, 0)) order by i), '[]')
               from generate_series(0, p_days - 1) i
               left join (select (started_at at time zone p_tz)::date as day, count(*) as n from cur group by 1) x on x.day = today - (p_days - 1) + i),
    'byChannel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'n', n, 'firstReplySeconds', fr, 'resolved', resolved) order by n desc), '[]')
                    from (select channel, count(*) as n,
                                 percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) filter (where reply_at is not null) as fr,
                                 count(*) filter (where resolved_at is not null) as resolved
                            from cur group by channel) x),
    'heat', (select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'block', block, 'n', n)), '[]')
               from (select extract(isodow from started_at at time zone p_tz)::int - 1 as dow, extract(hour from started_at at time zone p_tz)::int / 2 as block, count(*) as n
                       from cur group by 1, 2) h),
    'team', (select coalesce(jsonb_agg(jsonb_build_object(
                  'member', p.member_id,
                  'n', (select count(*) from pairs x where x.member_id = p.member_id),
                  'firstReplySeconds', (select percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) from cur where reply_by = p.member_id),
                  'resolved', (select count(*) from cur where resolved_by = p.member_id),
                  'handedOver', (select count(*) from hand where actor = p.member_id),
                  'received', (select count(*) from hand where to_member = p.member_id)
                ) order by (select count(*) from pairs x where x.member_id = p.member_id) desc), '[]')
               from people p)
  ) into result;
  return result;
end $$;
