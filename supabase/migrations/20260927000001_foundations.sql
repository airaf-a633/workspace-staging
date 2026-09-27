-- M1 Foundations: workspaces, roles and permissions, teams, members, invites, audit log.
-- Source of truth for permissions: docs/ROLES_AND_PERMISSIONS.md (approved 2026-09-27).
-- Every table carries workspace_id and has row-level security on. Helper functions are
-- SECURITY DEFINER with an empty search_path, and every name inside them is schema-qualified.

-- ---------------------------------------------------------------------------
-- Types and permission catalogue
-- ---------------------------------------------------------------------------

create type public.permission_scope as enum ('none', 'own', 'team', 'all');

create table public.permissions (
  key text primary key check (key ~ '^[a-z_]+\.[a-z_]+$'),
  description text not null,
  owner_only boolean not null default false
);

-- Scopes per role template, straight from the approved table.
create table public.role_template_permissions (
  template_key text not null check (template_key in ('owner','sales_manager','support_manager','ops_manager','agent','viewer')),
  permission text not null references public.permissions (key),
  scope public.permission_scope not null,
  primary key (template_key, permission)
);

insert into public.permissions (key, description, owner_only) values
  ('conversations.view',          'See conversations', false),
  ('conversations.reply',         'Reply as holder', false),
  ('conversations.override',      'Reply without taking over', false),
  ('conversations.claim',         'Claim unassigned conversations', false),
  ('conversations.handover',      'Hand over (note required)', false),
  ('conversations.collaborators', 'Add collaborators', false),
  ('conversations.notes',         'Write internal notes, mentions, staff chat', false),
  ('conversations.spam',          'Mark spam and block numbers', false),
  ('conversations.resolve',       'Resolve and reopen', false),
  ('contacts.view',               'See contacts', false),
  ('contacts.edit',               'Create and edit contacts', false),
  ('contacts.merge',              'Merge contacts', false),
  ('contacts.erase',              'Erase a contact (PDPL)', true),
  ('deals.view',                  'See deals and stages', false),
  ('deals.values',                'See deal values and revenue', false),
  ('deals.edit',                  'Create and edit deals', false),
  ('deals.close',                 'Mark deals Won or Lost', false),
  ('deals.approve',               'Approve discount requests', false),
  ('tasks.manage',                'Create and edit tasks', false),
  ('crm.settings',                'Manage pipelines, fields, tags', false),
  ('templates.manage',            'Create and submit templates', false),
  ('templates.send',              'Send templates in chats', false),
  ('campaigns.manage',            'Create campaigns', false),
  ('campaigns.send_segments',     'Send campaigns to segments', false),
  ('campaigns.request_imported',  'Request a campaign to an imported list', false),
  ('campaigns.send_imported',     'Approve and send to imported lists', true),
  ('automations.manage',          'Manage automations', false),
  ('canned.manage',               'Manage canned replies', false),
  ('canned.use',                  'Use canned replies', false),
  ('reports.view',                'See reports', false),
  ('reports.export',              'Export a report', false),
  ('data.bulk_export',            'Bulk export contacts and chats', true),
  ('members.manage',              'Invite, remove, change roles', true),
  ('teams.manage',                'Teams, hours, routing rules', false),
  ('numbers.manage',              'Connect WhatsApp numbers, Meta billing', true),
  ('connections.own',             'Connect own mailbox and calendar', false),
  ('billing.manage',              'Billing and plan', true),
  ('api.manage',                  'API keys', true),
  ('audit.read',                  'Read the audit log', true),
  ('orders.dispatch',             'Dispatch, riders and cash (Orders pack)', false),
  ('orders.create',               'Create orders from chat (Orders pack)', false);

-- Columns: owner, sales_manager, support_manager, ops_manager, agent, viewer
insert into public.role_template_permissions (template_key, permission, scope)
select t.template_key, m.permission, (m.scopes)[t.ord]::public.permission_scope
from (values
  ('conversations.view',          array['all','team','team','team','team','team']),
  ('conversations.reply',         array['all','own','own','own','own','none']),
  ('conversations.override',      array['all','team','team','none','none','none']),
  ('conversations.claim',         array['all','team','team','team','team','none']),
  ('conversations.handover',      array['all','team','team','own','own','none']),
  ('conversations.collaborators', array['all','own','own','own','own','none']),
  ('conversations.notes',         array['all','team','team','team','team','none']),
  ('conversations.spam',          array['all','team','team','none','none','none']),
  ('conversations.resolve',       array['all','team','team','own','own','none']),
  ('contacts.view',               array['all','all','all','all','all','team']),
  ('contacts.edit',               array['all','all','all','all','own','none']),
  ('contacts.merge',              array['all','all','all','none','none','none']),
  ('contacts.erase',              array['all','none','none','none','none','none']),
  ('deals.view',                  array['all','all','all','all','own','none']),
  ('deals.values',                array['all','all','none','none','own','none']),
  ('deals.edit',                  array['all','all','none','none','own','none']),
  ('deals.close',                 array['all','all','none','none','own','none']),
  ('deals.approve',               array['all','team','none','none','none','none']),
  ('tasks.manage',                array['all','team','team','all','own','none']),
  ('crm.settings',                array['all','team','none','none','none','none']),
  ('templates.manage',            array['all','team','team','none','none','none']),
  ('templates.send',              array['all','team','team','team','own','none']),
  ('campaigns.manage',            array['all','team','none','none','none','none']),
  ('campaigns.send_segments',     array['all','team','none','none','none','none']),
  ('campaigns.request_imported',  array['all','team','none','none','none','none']),
  ('campaigns.send_imported',     array['all','none','none','none','none','none']),
  ('automations.manage',          array['all','team','team','team','none','none']),
  ('canned.manage',               array['all','team','team','team','none','none']),
  ('canned.use',                  array['all','team','team','team','team','none']),
  ('reports.view',                array['all','team','team','team','none','team']),
  ('reports.export',              array['all','team','team','team','none','none']),
  ('data.bulk_export',            array['all','none','none','none','none','none']),
  ('members.manage',              array['all','none','none','none','none','none']),
  ('teams.manage',                array['all','team','team','team','none','none']),
  ('numbers.manage',              array['all','none','none','none','none','none']),
  ('connections.own',             array['all','own','own','own','own','none']),
  ('billing.manage',              array['all','none','none','none','none','none']),
  ('api.manage',                  array['all','none','none','none','none','none']),
  ('audit.read',                  array['all','none','none','none','none','none']),
  ('orders.dispatch',             array['all','none','none','all','none','none']),
  ('orders.create',               array['all','none','none','all','own','none'])
) as m(permission, scopes)
cross join (values
  ('owner',1),('sales_manager',2),('support_manager',3),('ops_manager',4),('agent',5),('viewer',6)
) as t(template_key, ord);

-- ---------------------------------------------------------------------------
-- Tenancy tables
-- ---------------------------------------------------------------------------

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  timezone text not null default 'Asia/Dubai',
  default_locale text not null default 'en' check (default_locale in ('en','ar')),
  currency char(3) not null default 'AED',
  plan text not null default 'trial',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]{2,40}$'),
  name text not null check (length(trim(name)) between 1 and 60),
  template_key text check (template_key in ('owner','sales_manager','support_manager','ops_manager','agent','viewer')),
  is_owner boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, key),
  unique (workspace_id, id)
);

create table public.role_permissions (
  workspace_id uuid not null,
  role_id uuid not null,
  permission text not null references public.permissions (key),
  scope public.permission_scope not null,
  primary key (role_id, permission),
  foreign key (workspace_id, role_id) references public.roles (workspace_id, id) on delete cascade
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  is_branch boolean not null default false,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (workspace_id, id)
);
create unique index teams_one_default on public.teams (workspace_id) where is_default;

create table public.members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null,
  display_name text not null check (length(trim(display_name)) between 1 and 80),
  locale text not null default 'en' check (locale in ('en','ar')),
  status text not null default 'active' check (status in ('active','removed')),
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (workspace_id, user_id),
  unique (workspace_id, id),
  foreign key (workspace_id, role_id) references public.roles (workspace_id, id)
);
create index members_user_idx on public.members (user_id) where status = 'active';
create index members_role_idx on public.members (role_id);

create table public.team_members (
  workspace_id uuid not null,
  team_id uuid not null,
  member_id uuid not null,
  primary key (team_id, member_id),
  foreign key (workspace_id, team_id) references public.teams (workspace_id, id) on delete cascade,
  foreign key (workspace_id, member_id) references public.members (workspace_id, id) on delete cascade
);
create index team_members_member_idx on public.team_members (member_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null check (email = lower(email) and email like '%@%'),
  role_id uuid not null,
  team_ids uuid[] not null default '{}',
  token_hash text not null unique,
  invited_by uuid,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, role_id) references public.roles (workspace_id, id) on delete cascade
);
create index invites_workspace_idx on public.invites (workspace_id) where accepted_at is null;

create table public.audit_log (
  id bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_member_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_log_workspace_idx on public.audit_log (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Permission helpers
-- ---------------------------------------------------------------------------

create function public.member_id(p_workspace uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.members m
  where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active'
$$;

create function public.is_member(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

create function public.permission_scope(p_workspace uuid, p_permission text)
returns public.permission_scope language sql stable security definer set search_path = '' as $$
  select coalesce((
    select rp.scope from public.members m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active'
      and rp.permission = p_permission
  ), 'none'::public.permission_scope)
$$;

create function public.has_permission(p_workspace uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.permission_scope(p_workspace, p_permission) <> 'none'
$$;

create function public.in_team(p_workspace uuid, p_team uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.team_members tm
    join public.members m on m.id = tm.member_id
    where tm.workspace_id = p_workspace and tm.team_id = p_team
      and m.user_id = auth.uid() and m.status = 'active'
  )
$$;

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------

-- Owner-only permissions can only be granted to the owner role.
create function public.guard_owner_only_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.scope <> 'none'
     and (select p.owner_only from public.permissions p where p.key = new.permission)
     and not (select r.is_owner from public.roles r where r.id = new.role_id) then
    raise exception 'Permission % is owner-only', new.permission using errcode = '42501';
  end if;
  return new;
end $$;
create trigger role_permissions_owner_only
  before insert or update on public.role_permissions
  for each row execute function public.guard_owner_only_permissions();

-- A workspace always keeps at least one active owner.
create function public.guard_last_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  was_owner boolean;
  still_owner boolean;
begin
  select r.is_owner into was_owner from public.roles r where r.id = old.role_id;
  if not was_owner or old.status <> 'active' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' then
    select r.is_owner into still_owner from public.roles r where r.id = new.role_id;
    if still_owner and new.status = 'active' then
      return new;
    end if;
  end if;
  if not exists (
    select 1 from public.members m join public.roles r on r.id = m.role_id
    where m.workspace_id = old.workspace_id and m.id <> old.id and m.status = 'active' and r.is_owner
  ) then
    raise exception 'A workspace must keep at least one owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger members_last_owner
  before update or delete on public.members
  for each row execute function public.guard_last_owner();

-- Only members.manage may change a member's role or status (blocks self-promotion through
-- the "edit your own profile" policy). Server-side jobs without a signed-in user are allowed.
create function public.guard_member_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (new.role_id is distinct from old.role_id or new.status is distinct from old.status
      or new.user_id is distinct from old.user_id or new.workspace_id is distinct from old.workspace_id)
     and auth.uid() is not null
     and not public.has_permission(old.workspace_id, 'members.manage') then
    raise exception 'Only the owner can change roles or remove members' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger members_access_guard
  before update on public.members
  for each row execute function public.guard_member_access_change();

-- The audit log is append-only, even for the table owner's roles used by the app.
create function public.forbid_audit_changes()
returns trigger language plpgsql as $$
begin
  raise exception 'The audit log is append-only' using errcode = '42501';
end $$;
create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function public.forbid_audit_changes();

-- Automatic audit entries for access-related changes.
create function public.audit_access_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  ws uuid := (rec ->> 'workspace_id')::uuid;
begin
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (
    ws,
    public.member_id(ws),
    lower(tg_op),
    tg_table_name,
    coalesce(rec ->> 'id', rec ->> 'role_id', rec ->> 'team_id'),
    case when tg_op = 'UPDATE' then jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new)) else rec - 'token_hash' end
  );
  return coalesce(new, old);
end $$;
create trigger audit_members after insert or update or delete on public.members
  for each row execute function public.audit_access_change();
create trigger audit_roles after insert or update or delete on public.roles
  for each row execute function public.audit_access_change();
create trigger audit_role_permissions after insert or update or delete on public.role_permissions
  for each row execute function public.audit_access_change();
create trigger audit_team_members after insert or delete on public.team_members
  for each row execute function public.audit_access_change();
create trigger audit_invites after insert or update or delete on public.invites
  for each row execute function public.audit_access_change();

create function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
create trigger workspaces_touch before update on public.workspaces
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Workflows (called by the app; they run with elevated rights but check the caller)
-- ---------------------------------------------------------------------------

-- Creates a workspace with the six role templates, a default team, and the caller as owner.
create function public.create_workspace(p_name text, p_slug text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  owner_role uuid;
  default_team uuid;
  new_member uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a workspace' using errcode = '42501';
  end if;

  insert into public.workspaces (name, slug) values (p_name, p_slug) returning id into ws;

  insert into public.roles (workspace_id, key, name, template_key, is_owner)
  values
    (ws, 'owner',           'Owner',              'owner',           true),
    (ws, 'sales_manager',   'Sales manager',      'sales_manager',   false),
    (ws, 'support_manager', 'Support manager',    'support_manager', false),
    (ws, 'ops_manager',     'Operations manager', 'ops_manager',     false),
    (ws, 'agent',           'Agent',              'agent',           false),
    (ws, 'viewer',          'Viewer',             'viewer',          false);

  insert into public.role_permissions (workspace_id, role_id, permission, scope)
  select ws, r.id, t.permission, t.scope
  from public.roles r
  join public.role_template_permissions t on t.template_key = r.template_key
  where r.workspace_id = ws;

  select id into owner_role from public.roles where workspace_id = ws and key = 'owner';
  insert into public.teams (workspace_id, name, is_default) values (ws, 'General', true) returning id into default_team;
  insert into public.members (workspace_id, user_id, role_id, display_name)
  values (ws, auth.uid(), owner_role, p_display_name) returning id into new_member;
  insert into public.team_members (workspace_id, team_id, member_id) values (ws, default_team, new_member);

  return ws;
end $$;

-- Creates an invite and returns the one-time token (only its hash is stored).
create function public.create_invite(p_workspace uuid, p_email text, p_role uuid, p_team_ids uuid[] default '{}')
returns text language plpgsql security definer set search_path = '' as $$
declare
  token text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if not public.has_permission(p_workspace, 'members.manage') then
    raise exception 'Only the owner can invite members' using errcode = '42501';
  end if;
  insert into public.invites (workspace_id, email, role_id, team_ids, token_hash, invited_by)
  values (p_workspace, lower(trim(p_email)), p_role, p_team_ids,
          encode(sha256(convert_to(token, 'UTF8')), 'hex'), public.member_id(p_workspace));
  return token;
end $$;

-- Accepts an invite for the signed-in user; the invite email must match their account email.
create function public.accept_invite(p_token text, p_display_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
  new_member uuid;
  t uuid;
begin
  select * into inv from public.invites
  where token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if inv.id is null then
    raise exception 'This invite link is invalid or has expired' using errcode = '22023';
  end if;
  if inv.email <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'This invite was sent to a different email address' using errcode = '42501';
  end if;

  insert into public.members (workspace_id, user_id, role_id, display_name)
  values (inv.workspace_id, auth.uid(), inv.role_id, p_display_name)
  returning id into new_member;

  foreach t in array inv.team_ids loop
    insert into public.team_members (workspace_id, team_id, member_id) values (inv.workspace_id, t, new_member);
  end loop;
  if cardinality(inv.team_ids) = 0 then
    insert into public.team_members (workspace_id, team_id, member_id)
    select inv.workspace_id, tm.id, new_member from public.teams tm where tm.workspace_id = inv.workspace_id and tm.is_default;
  end if;

  update public.invites set accepted_at = now() where id = inv.id;
  return inv.workspace_id;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.permissions enable row level security;
alter table public.role_template_permissions enable row level security;
alter table public.workspaces enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.teams enable row level security;
alter table public.members enable row level security;
alter table public.team_members enable row level security;
alter table public.invites enable row level security;
alter table public.audit_log enable row level security;

-- Catalogue: readable by any signed-in user, never writable from the app.
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy templates_read on public.role_template_permissions for select to authenticated using (true);

create policy workspaces_read on public.workspaces for select to authenticated
  using ((select public.is_member(id)));
create policy workspaces_update on public.workspaces for update to authenticated
  using ((select public.has_permission(id, 'members.manage')))
  with check ((select public.has_permission(id, 'members.manage')));

create policy roles_read on public.roles for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy roles_write on public.roles for all to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')))
  with check ((select public.has_permission(workspace_id, 'members.manage')) and not is_owner);

create policy role_permissions_read on public.role_permissions for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy role_permissions_write on public.role_permissions for all to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')))
  with check ((select public.has_permission(workspace_id, 'members.manage')));

create policy teams_read on public.teams for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy teams_insert on public.teams for insert to authenticated
  with check ((select public.permission_scope(workspace_id, 'teams.manage')) = 'all');
create policy teams_update on public.teams for update to authenticated
  using ((select public.permission_scope(workspace_id, 'teams.manage')) = 'all'
         or ((select public.permission_scope(workspace_id, 'teams.manage')) = 'team' and public.in_team(workspace_id, id)))
  with check (true);
create policy teams_delete on public.teams for delete to authenticated
  using ((select public.permission_scope(workspace_id, 'teams.manage')) = 'all' and not is_default);

create policy members_read on public.members for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy members_write on public.members for all to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')))
  with check ((select public.has_permission(workspace_id, 'members.manage')));
-- Everyone can edit their own display name and language (column grants below limit what).
create policy members_self_update on public.members for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy team_members_read on public.team_members for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy team_members_write on public.team_members for all to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')))
  with check ((select public.has_permission(workspace_id, 'members.manage')));

create policy invites_owner on public.invites for all to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')))
  with check ((select public.has_permission(workspace_id, 'members.manage')));

create policy audit_read on public.audit_log for select to authenticated
  using ((select public.has_permission(workspace_id, 'audit.read')));

-- ---------------------------------------------------------------------------
-- Grants: nothing for anonymous users; the audit log is read-only to the app.
-- ---------------------------------------------------------------------------

revoke all on public.permissions, public.role_template_permissions, public.workspaces, public.roles,
  public.role_permissions, public.teams, public.members, public.team_members, public.invites,
  public.audit_log from anon;
revoke insert, update, delete, truncate on public.permissions, public.role_template_permissions from authenticated;
revoke insert, update, delete, truncate on public.audit_log from authenticated;
revoke insert, delete on public.workspaces from authenticated;
-- Members may only change display_name and locale on their own row; role changes need members.manage.
revoke update on public.members from authenticated;
grant update (display_name, locale) on public.members to authenticated;
grant update (role_id, status, removed_at) on public.members to authenticated;

revoke execute on all functions in schema public from anon;
revoke execute on function public.guard_owner_only_permissions(), public.guard_last_owner(),
  public.forbid_audit_changes(), public.audit_access_change(), public.touch_updated_at(),
  public.guard_member_access_change() from authenticated;
