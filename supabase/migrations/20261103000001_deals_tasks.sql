-- Deals and tasks on real data (decided 2026-11-03).
--
-- Decided with the founder: one pipeline with the fixed stages New, Quoted, Negotiating (stored as rows, so more pipelines and
-- editable stages can come later with no data change); Won and Lost are outcomes; one currency per workspace; discount
-- approvals included; tasks repeat, snooze and have notes (no calendar sync yet).
--
-- Who sees what mirrors @app/domain's covers() and canSeeDealValue(), so the screens never offer what the database would refuse:
--   deals.view / edit / close / approve and tasks.manage have a scope: all, team (their teams plus their own) or own.
--   A deal's money lives in its own table, readable only by roles allowed to see deal values.

-- One currency per workspace; new ones start in US dollars (the column's old default was AED).
alter table public.workspaces alter column currency set default 'USD';

-- ---------------------------------------------------------------------------
-- Pipelines
-- ---------------------------------------------------------------------------

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index pipelines_one_default on public.pipelines (workspace_id) where is_default;

-- key is what the screens translate ("new", "quoted", "negotiating"); name is the fallback shown if a stage is ever renamed.
create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id) on delete cascade,
  key text not null check (length(btrim(key)) between 1 and 40),
  name text not null check (length(btrim(name)) between 1 and 60),
  position int not null,
  unique (pipeline_id, key)
);

create function public.seed_default_pipeline(p_workspace uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  p uuid;
begin
  if exists (select 1 from public.pipelines where workspace_id = p_workspace and is_default) then return; end if;
  insert into public.pipelines (workspace_id, name, is_default) values (p_workspace, 'Sales', true) returning id into p;
  insert into public.pipeline_stages (workspace_id, pipeline_id, key, name, position)
  values (p_workspace, p, 'new', 'New', 1), (p_workspace, p, 'quoted', 'Quoted', 2), (p_workspace, p, 'negotiating', 'Negotiating', 3);
end $$;

create function public.workspaces_seed_pipeline() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.seed_default_pipeline(new.id);
  return new;
end $$;
create trigger workspaces_seed_pipeline after insert on public.workspaces for each row execute function public.workspaces_seed_pipeline();
select public.seed_default_pipeline(id) from public.workspaces;

-- ---------------------------------------------------------------------------
-- Deals
-- ---------------------------------------------------------------------------

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  pipeline_id uuid not null references public.pipelines (id),
  -- The open stage the deal is in, or was in when it closed.
  stage_id uuid not null references public.pipeline_stages (id),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  title text not null check (length(btrim(title)) between 1 and 200),
  contact_id uuid references public.contacts (id) on delete cascade,
  owner_member_id uuid references public.members (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  expected_close date,
  lost_reason text check (lost_reason in ('Price', 'Stock', 'Went silent', 'Competitor', 'Other')),
  closed_at timestamptz,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'lost') = (lost_reason is not null)),
  check ((status = 'open') = (closed_at is null))
);
create index deals_workspace_status on public.deals (workspace_id, status);
create index deals_contact on public.deals (contact_id);
create index deals_owner on public.deals (owner_member_id);

-- Money, apart from the deal: only roles that may see deal values can read this table.
create table public.deal_values (
  deal_id uuid primary key references public.deals (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  value_minor bigint not null default 0 check (value_minor >= 0)
);

create table public.deal_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  author_member_id uuid references public.members (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index deal_notes_deal on public.deal_notes (deal_id, created_at);

-- What happened to a deal. No amounts here: the same rows are readable by roles that can't see money.
create table public.deal_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  kind text not null check (kind in ('created', 'moved', 'won', 'lost', 'reopened', 'owner_changed', 'team_changed', 'value_changed',
                                     'approval_requested', 'approval_approved', 'approval_declined')),
  actor_member_id uuid references public.members (id) on delete set null,
  data jsonb not null default '{}',
  created_at timestamptz not null default clock_timestamp()
);
create index deal_events_deal on public.deal_events (deal_id, created_at);

-- A rep asks for a percentage off; a manager decides. Only the percentage is stored: the new value is worked out
-- when it is approved, so this table needs no money either.
create table public.deal_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  deal_id uuid not null references public.deals (id) on delete cascade,
  requested_by uuid references public.members (id) on delete set null,
  percent numeric(5, 2) not null check (percent > 0 and percent <= 100),
  note text check (length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by uuid references public.members (id) on delete set null,
  decision_note text check (length(decision_note) <= 500),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index deal_approvals_one_pending on public.deal_approvals (deal_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- Tasks
-- ---------------------------------------------------------------------------

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  text text not null check (length(btrim(text)) between 1 and 500),
  owner_member_id uuid references public.members (id) on delete set null,
  team_id uuid references public.teams (id) on delete set null,
  contact_id uuid references public.contacts (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  -- With has_time false only the day counts; the time stored is then that day's start in the member's time zone.
  due_at timestamptz,
  has_time boolean not null default false,
  repeat text check (repeat in ('daily', 'weekly', 'monthly')),
  done_at timestamptz,
  -- The task that was finished to make this one (a repeat), so finishing can be undone.
  source_task_id uuid references public.tasks (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now()
);
create index tasks_owner_open on public.tasks (workspace_id, owner_member_id) where done_at is null;
create index tasks_contact on public.tasks (contact_id);
create index tasks_deal on public.tasks (deal_id);

create table public.task_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_member_id uuid references public.members (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index task_notes_task on public.task_notes (task_id, created_at);

-- ---------------------------------------------------------------------------
-- Who may see and change what
-- ---------------------------------------------------------------------------

-- Does the caller's scope for this permission reach a thing in this team, owned by this member? Same rule as covers().
create function public.in_scope(p_workspace uuid, p_permission text, p_team uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.permission_scope(p_workspace, p_permission)
    when 'all' then true
    when 'team' then (p_owner is not null and p_owner = public.member_id(p_workspace)) or (p_team is not null and public.in_team(p_workspace, p_team))
    when 'own' then p_owner is not null and p_owner = public.member_id(p_workspace)
    else false
  end
$$;

-- Same rule as canSeeDealValue(): all and team see every value, own sees the values of their own deals.
create function public.can_see_value(p_workspace uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.permission_scope(p_workspace, 'deals.values')
    when 'all' then true
    when 'team' then true
    when 'own' then p_owner is not null and p_owner = public.member_id(p_workspace)
    else false
  end
$$;

create function public.deal_allows(p_deal uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.in_scope(d.workspace_id, p_permission, d.team_id, d.owner_member_id) from public.deals d where d.id = p_deal), false)
$$;

create function public.deal_value_visible(p_deal uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) and public.can_see_value(d.workspace_id, d.owner_member_id)
                     from public.deals d where d.id = p_deal), false)
$$;

create function public.task_allows(p_task uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) from public.tasks t where t.id = p_task), false)
$$;

alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.deals enable row level security;
alter table public.deal_values enable row level security;
alter table public.deal_notes enable row level security;
alter table public.deal_events enable row level security;
alter table public.deal_approvals enable row level security;
alter table public.tasks enable row level security;
alter table public.task_notes enable row level security;

create policy pipelines_read on public.pipelines for select to authenticated using ((select public.is_member(workspace_id)));
create policy pipeline_stages_read on public.pipeline_stages for select to authenticated using ((select public.is_member(workspace_id)));
create policy deals_read on public.deals for select to authenticated using ((select public.in_scope(workspace_id, 'deals.view', team_id, owner_member_id)));
create policy deal_values_read on public.deal_values for select to authenticated using ((select public.deal_value_visible(deal_id)));
create policy deal_notes_read on public.deal_notes for select to authenticated using ((select public.deal_allows(deal_id, 'deals.view')));
create policy deal_events_read on public.deal_events for select to authenticated using ((select public.deal_allows(deal_id, 'deals.view')));
create policy deal_approvals_read on public.deal_approvals for select to authenticated using ((select public.deal_allows(deal_id, 'deals.view')));
create policy tasks_read on public.tasks for select to authenticated using ((select public.in_scope(workspace_id, 'tasks.manage', team_id, owner_member_id)));
create policy task_notes_read on public.task_notes for select to authenticated using ((select public.task_allows(task_id)));

revoke all on public.pipelines, public.pipeline_stages, public.deals, public.deal_values, public.deal_notes, public.deal_events,
  public.deal_approvals, public.tasks, public.task_notes from anon;
revoke insert, update, delete, truncate on public.pipelines, public.pipeline_stages, public.deals, public.deal_values, public.deal_notes,
  public.deal_events, public.deal_approvals, public.tasks, public.task_notes from authenticated;

-- ---------------------------------------------------------------------------
-- Deals: actions
-- ---------------------------------------------------------------------------

-- A teammate has to be an active member of the same workspace.
create function public.active_member(p_workspace uuid, p_member uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.members where id = p_member and workspace_id = p_workspace and status = 'active')
$$;

-- The first team of a member, or the workspace's default team.
create function public.home_team(p_workspace uuid, p_member uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select tm.team_id from public.team_members tm join public.teams t on t.id = tm.team_id where tm.member_id = p_member and tm.workspace_id = p_workspace order by t.is_default, t.name limit 1),
    (select id from public.teams where workspace_id = p_workspace and is_default limit 1))
$$;

create function public.log_deal(p_deal uuid, p_kind text, p_data jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.deal_events (workspace_id, deal_id, kind, actor_member_id, data)
  select d.workspace_id, d.id, p_kind, public.member_id(d.workspace_id), coalesce(p_data, '{}') from public.deals d where d.id = p_deal
$$;

create function public.create_deal(
  p_workspace uuid, p_title text, p_contact uuid default null, p_value_minor bigint default 0,
  p_owner uuid default null, p_team uuid default null, p_expected_close date default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.member_id(p_workspace);
  owner_id uuid;
  team_id uuid;
  pipe uuid;
  stage uuid;
  deal uuid;
  value bigint := coalesce(p_value_minor, 0);
begin
  if me is null or public.permission_scope(p_workspace, 'deals.edit') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_title, ''))) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
  if value < 0 then raise exception 'bad_value' using errcode = '22023'; end if;
  owner_id := coalesce(p_owner, me);
  if not public.active_member(p_workspace, owner_id) then raise exception 'bad_owner' using errcode = '22023'; end if;
  team_id := coalesce(p_team, public.home_team(p_workspace, owner_id));
  if team_id is not null and not exists (select 1 from public.teams where id = team_id and workspace_id = p_workspace) then raise exception 'bad_team' using errcode = '22023'; end if;
  -- The caller must be able to reach the deal they create (a rep with "own" scope creates their own).
  if not public.in_scope(p_workspace, 'deals.edit', team_id, owner_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_contact is not null and (not exists (select 1 from public.contacts where id = p_contact and workspace_id = p_workspace) or not public.contact_visible(p_contact)) then
    raise exception 'bad_contact' using errcode = '22023';
  end if;
  -- Only people who may see deal values may set one.
  if value > 0 and not public.can_see_value(p_workspace, owner_id) then value := 0; end if;

  select id into pipe from public.pipelines where workspace_id = p_workspace and is_default;
  select id into stage from public.pipeline_stages where pipeline_id = pipe order by position limit 1;
  insert into public.deals (workspace_id, pipeline_id, stage_id, title, contact_id, owner_member_id, team_id, expected_close, created_by)
  values (p_workspace, pipe, stage, btrim(p_title), p_contact, owner_id, team_id, p_expected_close, me) returning id into deal;
  insert into public.deal_values (deal_id, workspace_id, value_minor) values (deal, p_workspace, value);
  perform public.log_deal(deal, 'created');
  return deal;
end $$;

-- Changes the fields present in p_patch: title, stage (a stage key), value_minor, owner, team, expected_close, contact.
create function public.update_deal(p_deal uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
  new_stage uuid;
  new_owner uuid;
  new_team uuid;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.edit', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status <> 'open' and (p_patch ? 'stage' or p_patch ? 'value_minor') then raise exception 'closed' using errcode = 'P0001'; end if;

  if p_patch ? 'title' then
    if length(btrim(coalesce(p_patch ->> 'title', ''))) not between 1 and 200 then raise exception 'bad_title' using errcode = '22023'; end if;
    update public.deals set title = btrim(p_patch ->> 'title') where id = d.id;
  end if;
  if p_patch ? 'stage' then
    select id into new_stage from public.pipeline_stages where pipeline_id = d.pipeline_id and key = p_patch ->> 'stage';
    if new_stage is null then raise exception 'bad_stage' using errcode = '22023'; end if;
    if new_stage <> d.stage_id then
      update public.deals set stage_id = new_stage where id = d.id;
      perform public.log_deal(d.id, 'moved', jsonb_build_object('to', p_patch ->> 'stage'));
    end if;
  end if;
  if p_patch ? 'value_minor' then
    if (p_patch ->> 'value_minor')::bigint < 0 then raise exception 'bad_value' using errcode = '22023'; end if;
    if not public.can_see_value(d.workspace_id, d.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.deal_values set value_minor = (p_patch ->> 'value_minor')::bigint where deal_id = d.id;
    perform public.log_deal(d.id, 'value_changed');
  end if;
  if p_patch ? 'owner' then
    new_owner := (p_patch ->> 'owner')::uuid;
    if new_owner is not null and not public.active_member(d.workspace_id, new_owner) then raise exception 'bad_owner' using errcode = '22023'; end if;
    update public.deals set owner_member_id = new_owner where id = d.id;
    perform public.log_deal(d.id, 'owner_changed', jsonb_build_object('to', new_owner));
  end if;
  if p_patch ? 'team' then
    new_team := (p_patch ->> 'team')::uuid;
    if new_team is not null and not exists (select 1 from public.teams where id = new_team and workspace_id = d.workspace_id) then raise exception 'bad_team' using errcode = '22023'; end if;
    update public.deals set team_id = new_team where id = d.id;
    perform public.log_deal(d.id, 'team_changed', jsonb_build_object('to', new_team));
  end if;
  if p_patch ? 'expected_close' then
    update public.deals set expected_close = nullif(p_patch ->> 'expected_close', '')::date where id = d.id;
  end if;
  if p_patch ? 'contact' then
    if p_patch ->> 'contact' is not null and (not exists (select 1 from public.contacts where id = (p_patch ->> 'contact')::uuid and workspace_id = d.workspace_id)
                                               or not public.contact_visible((p_patch ->> 'contact')::uuid)) then
      raise exception 'bad_contact' using errcode = '22023';
    end if;
    update public.deals set contact_id = nullif(p_patch ->> 'contact', '')::uuid where id = d.id;
  end if;
  update public.deals set updated_at = now() where id = d.id;
end $$;

-- Won needs a final value above zero; Lost needs a reason from the list.
create function public.close_deal_won(p_deal uuid, p_final_minor bigint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.close', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status <> 'open' then raise exception 'closed' using errcode = 'P0001'; end if;
  if coalesce(p_final_minor, 0) <= 0 then raise exception 'bad_value' using errcode = '22023'; end if;
  if not public.can_see_value(d.workspace_id, d.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.deal_values set value_minor = p_final_minor where deal_id = d.id;
  update public.deals set status = 'won', closed_at = now(), updated_at = now() where id = d.id;
  update public.deal_approvals set status = 'declined', decided_at = now(), decision_note = 'Closed' where deal_id = d.id and status = 'pending';
  perform public.log_deal(d.id, 'won');
end $$;

create function public.close_deal_lost(p_deal uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.close', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status <> 'open' then raise exception 'closed' using errcode = 'P0001'; end if;
  if p_reason not in ('Price', 'Stock', 'Went silent', 'Competitor', 'Other') then raise exception 'bad_reason' using errcode = '22023'; end if;
  update public.deals set status = 'lost', lost_reason = p_reason, closed_at = now(), updated_at = now() where id = d.id;
  update public.deal_approvals set status = 'declined', decided_at = now(), decision_note = 'Closed' where deal_id = d.id and status = 'pending';
  perform public.log_deal(d.id, 'lost', jsonb_build_object('reason', p_reason));
end $$;

create function public.reopen_deal(p_deal uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.close', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status = 'open' then return; end if;
  update public.deals set status = 'open', lost_reason = null, closed_at = null, updated_at = now() where id = d.id;
  perform public.log_deal(d.id, 'reopened');
end $$;

create function public.add_deal_note(p_deal uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
  n uuid;
begin
  select * into d from public.deals where id = p_deal;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.edit', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 2000 then raise exception 'bad_note' using errcode = '22023'; end if;
  insert into public.deal_notes (workspace_id, deal_id, author_member_id, body) values (d.workspace_id, d.id, public.member_id(d.workspace_id), btrim(p_body)) returning id into n;
  return n;
end $$;

-- A rep asks for a percentage off an open deal; one request at a time.
create function public.request_discount(p_deal uuid, p_percent numeric, p_note text default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
  a uuid;
begin
  select * into d from public.deals where id = p_deal for update;
  if not found or not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.edit', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if d.status <> 'open' then raise exception 'closed' using errcode = 'P0001'; end if;
  if p_percent is null or p_percent <= 0 or p_percent > 100 then raise exception 'bad_percent' using errcode = '22023'; end if;
  if exists (select 1 from public.deal_approvals where deal_id = d.id and status = 'pending') then raise exception 'already_pending' using errcode = 'P0001'; end if;
  insert into public.deal_approvals (workspace_id, deal_id, requested_by, percent, note)
  values (d.workspace_id, d.id, public.member_id(d.workspace_id), p_percent, left(nullif(btrim(coalesce(p_note, '')), ''), 500)) returning id into a;
  perform public.log_deal(d.id, 'approval_requested', jsonb_build_object('percent', p_percent));
  return a;
end $$;

-- A manager approves (the value drops by that percentage) or declines. Not your own request.
create function public.decide_discount(p_approval uuid, p_approve boolean, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  a public.deal_approvals%rowtype;
  d public.deals%rowtype;
  me uuid;
begin
  select * into a from public.deal_approvals where id = p_approval for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into d from public.deals where id = a.deal_id for update;
  me := public.member_id(d.workspace_id);
  if not public.in_scope(d.workspace_id, 'deals.view', d.team_id, d.owner_member_id) or not public.in_scope(d.workspace_id, 'deals.approve', d.team_id, d.owner_member_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if a.requested_by is not distinct from me then raise exception 'own_request' using errcode = '42501'; end if;
  if a.status <> 'pending' or d.status <> 'open' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  update public.deal_approvals set status = case when p_approve then 'approved' else 'declined' end, decided_by = me,
         decision_note = left(nullif(btrim(coalesce(p_note, '')), ''), 500), decided_at = now() where id = a.id;
  if p_approve then
    update public.deal_values set value_minor = round(value_minor * (100 - a.percent) / 100)::bigint where deal_id = d.id;
    perform public.log_deal(d.id, 'approval_approved', jsonb_build_object('percent', a.percent));
  else
    perform public.log_deal(d.id, 'approval_declined', jsonb_build_object('percent', a.percent));
  end if;
  if nullif(btrim(coalesce(p_note, '')), '') is not null then
    insert into public.deal_notes (workspace_id, deal_id, author_member_id, body) values (d.workspace_id, d.id, me, left(btrim(p_note), 2000));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Tasks: actions
-- ---------------------------------------------------------------------------

create function public.create_task(
  p_workspace uuid, p_text text, p_owner uuid default null, p_contact uuid default null, p_deal uuid default null,
  p_due timestamptz default null, p_has_time boolean default false, p_repeat text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.member_id(p_workspace);
  owner_id uuid;
  team_id uuid;
  task uuid;
begin
  if me is null or public.permission_scope(p_workspace, 'tasks.manage') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_text, ''))) not between 1 and 500 then raise exception 'bad_text' using errcode = '22023'; end if;
  if p_repeat is not null and p_repeat not in ('daily', 'weekly', 'monthly') then raise exception 'bad_repeat' using errcode = '22023'; end if;
  if p_repeat is not null and p_due is null then raise exception 'repeat_needs_date' using errcode = '22023'; end if;
  owner_id := coalesce(p_owner, me);
  if not public.active_member(p_workspace, owner_id) then raise exception 'bad_owner' using errcode = '22023'; end if;
  team_id := public.home_team(p_workspace, owner_id);
  if not public.in_scope(p_workspace, 'tasks.manage', team_id, owner_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_contact is not null and (not exists (select 1 from public.contacts where id = p_contact and workspace_id = p_workspace) or not public.contact_visible(p_contact)) then
    raise exception 'bad_contact' using errcode = '22023';
  end if;
  if p_deal is not null and (not exists (select 1 from public.deals where id = p_deal and workspace_id = p_workspace) or not public.deal_allows(p_deal, 'deals.view')) then
    raise exception 'bad_deal' using errcode = '22023';
  end if;
  insert into public.tasks (workspace_id, text, owner_member_id, team_id, contact_id, deal_id, due_at, has_time, repeat, created_by)
  values (p_workspace, btrim(p_text), owner_id, team_id, p_contact, p_deal, p_due, coalesce(p_has_time, false) and p_due is not null, p_repeat, me)
  returning id into task;
  return task;
end $$;

-- Changes the fields present in p_patch: text, due (a time or null), has_time, repeat, owner, contact.
create function public.update_task(p_task uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  new_owner uuid;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_patch ? 'text' then
    if length(btrim(coalesce(p_patch ->> 'text', ''))) not between 1 and 500 then raise exception 'bad_text' using errcode = '22023'; end if;
    update public.tasks set text = btrim(p_patch ->> 'text') where id = t.id;
  end if;
  if p_patch ? 'due' then update public.tasks set due_at = nullif(p_patch ->> 'due', '')::timestamptz where id = t.id; end if;
  if p_patch ? 'has_time' then update public.tasks set has_time = coalesce((p_patch ->> 'has_time')::boolean, false) where id = t.id; end if;
  if p_patch ? 'repeat' then
    if p_patch ->> 'repeat' is not null and p_patch ->> 'repeat' not in ('daily', 'weekly', 'monthly') then raise exception 'bad_repeat' using errcode = '22023'; end if;
    update public.tasks set repeat = p_patch ->> 'repeat' where id = t.id;
  end if;
  if p_patch ? 'owner' then
    new_owner := (p_patch ->> 'owner')::uuid;
    if new_owner is null or not public.active_member(t.workspace_id, new_owner) then raise exception 'bad_owner' using errcode = '22023'; end if;
    if not public.in_scope(t.workspace_id, 'tasks.manage', public.home_team(t.workspace_id, new_owner), new_owner) then raise exception 'not_allowed' using errcode = '42501'; end if;
    update public.tasks set owner_member_id = new_owner, team_id = public.home_team(t.workspace_id, new_owner) where id = t.id;
  end if;
  if p_patch ? 'contact' then
    if p_patch ->> 'contact' is not null and (not exists (select 1 from public.contacts where id = (p_patch ->> 'contact')::uuid and workspace_id = t.workspace_id)
                                               or not public.contact_visible((p_patch ->> 'contact')::uuid)) then
      raise exception 'bad_contact' using errcode = '22023';
    end if;
    update public.tasks set contact_id = nullif(p_patch ->> 'contact', '')::uuid where id = t.id;
  end if;
  if exists (select 1 from public.tasks where id = t.id and repeat is not null and due_at is null) then raise exception 'repeat_needs_date' using errcode = '22023'; end if;
end $$;

-- Finishing a repeating task makes the next one, counted in the workspace's own time zone so a daily task stays at the same hour
-- across a clock change. Returns the new task's id, or null.
create function public.complete_task(p_task uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  tz text;
  step interval;
  next_due timestamptz;
  next_id uuid;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if t.done_at is not null then return null; end if;
  update public.tasks set done_at = now() where id = t.id;
  if t.repeat is null then return null; end if;
  select timezone into tz from public.workspaces where id = t.workspace_id;
  step := case t.repeat when 'daily' then interval '1 day' when 'weekly' then interval '7 days' else interval '1 month' end;
  next_due := ((coalesce(t.due_at, now()) at time zone coalesce(tz, 'UTC')) + step) at time zone coalesce(tz, 'UTC');
  -- A task finished days late does not come back already overdue.
  while next_due <= now() loop
    next_due := ((next_due at time zone coalesce(tz, 'UTC')) + step) at time zone coalesce(tz, 'UTC');
  end loop;
  insert into public.tasks (workspace_id, text, owner_member_id, team_id, contact_id, deal_id, due_at, has_time, repeat, source_task_id, created_by)
  values (t.workspace_id, t.text, t.owner_member_id, t.team_id, t.contact_id, t.deal_id, next_due, t.has_time, t.repeat, t.id, public.member_id(t.workspace_id))
  returning id into next_id;
  return next_id;
end $$;

-- Undo: the task is open again, and the repeat made from it (if nobody has finished it) is removed.
create function public.undo_complete_task(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.tasks set done_at = null where id = t.id;
  delete from public.tasks where source_task_id = t.id and done_at is null;
end $$;

create function public.snooze_task(p_task uuid, p_due timestamptz, p_has_time boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_due is null then raise exception 'bad_due' using errcode = '22023'; end if;
  update public.tasks set due_at = p_due, has_time = coalesce(p_has_time, false) where id = t.id and done_at is null;
end $$;

-- Notes: whoever can manage the task, and its owner.
create function public.add_task_note(p_task uuid, p_body text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
  n uuid;
begin
  select * into t from public.tasks where id = p_task;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_body, ''))) not between 1 and 1000 then raise exception 'bad_note' using errcode = '22023'; end if;
  insert into public.task_notes (workspace_id, task_id, author_member_id, body) values (t.workspace_id, t.id, public.member_id(t.workspace_id), btrim(p_body)) returning id into n;
  return n;
end $$;

create function public.delete_task(p_task uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.tasks%rowtype;
begin
  select * into t from public.tasks where id = p_task for update;
  if not found or not public.in_scope(t.workspace_id, 'tasks.manage', t.team_id, t.owner_member_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.tasks where id = t.id;
end $$;

-- The workspace's currency (owner only): every deal value is shown in it.
create function public.set_workspace_currency(p_workspace uuid, p_currency text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission(p_workspace, 'billing.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'bad_currency' using errcode = '22023'; end if;
  update public.workspaces set currency = p_currency where id = p_workspace;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'update', 'workspaces', p_workspace::text, jsonb_build_object('currency', p_currency));
end $$;

revoke all on function public.seed_default_pipeline(uuid), public.workspaces_seed_pipeline(), public.log_deal(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function
  public.in_scope(uuid, text, uuid, uuid), public.can_see_value(uuid, uuid), public.deal_allows(uuid, text), public.deal_value_visible(uuid), public.task_allows(uuid),
  public.active_member(uuid, uuid), public.home_team(uuid, uuid),
  public.create_deal(uuid, text, uuid, bigint, uuid, uuid, date), public.update_deal(uuid, jsonb), public.close_deal_won(uuid, bigint),
  public.close_deal_lost(uuid, text), public.reopen_deal(uuid), public.add_deal_note(uuid, text), public.request_discount(uuid, numeric, text),
  public.decide_discount(uuid, boolean, text),
  public.create_task(uuid, text, uuid, uuid, uuid, timestamptz, boolean, text), public.update_task(uuid, jsonb), public.complete_task(uuid),
  public.undo_complete_task(uuid), public.snooze_task(uuid, timestamptz, boolean), public.add_task_note(uuid, text), public.delete_task(uuid),
  public.set_workspace_currency(uuid, text)
from public, anon;
grant execute on function
  public.in_scope(uuid, text, uuid, uuid), public.can_see_value(uuid, uuid), public.deal_allows(uuid, text), public.deal_value_visible(uuid), public.task_allows(uuid),
  public.create_deal(uuid, text, uuid, bigint, uuid, uuid, date), public.update_deal(uuid, jsonb), public.close_deal_won(uuid, bigint),
  public.close_deal_lost(uuid, text), public.reopen_deal(uuid), public.add_deal_note(uuid, text), public.request_discount(uuid, numeric, text),
  public.decide_discount(uuid, boolean, text),
  public.create_task(uuid, text, uuid, uuid, uuid, timestamptz, boolean, text), public.update_task(uuid, jsonb), public.complete_task(uuid),
  public.undo_complete_task(uuid), public.snooze_task(uuid, timestamptz, boolean), public.add_task_note(uuid, text), public.delete_task(uuid),
  public.set_workspace_currency(uuid, text)
to authenticated;
-- active_member and home_team are internal helpers: the functions above call them as the database owner.
revoke all on function public.active_member(uuid, uuid), public.home_team(uuid, uuid) from authenticated;
