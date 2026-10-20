-- Admin role (decided 2026-10-07): channels and integrations, members and teams, settings, automations,
-- SLAs, billing and data export. In permissions an admin equals the owner; what stays with owners is
-- everything about owners themselves: an admin can't invite, promote, demote or remove an owner.

-- 1. A seventh role template. Its scopes are the owner's, row for row.
alter table public.role_template_permissions drop constraint role_template_permissions_template_key_check;
alter table public.role_template_permissions add constraint role_template_permissions_template_key_check
  check (template_key in ('owner','admin','sales_manager','support_manager','ops_manager','agent','viewer'));

alter table public.roles drop constraint roles_template_key_check;
alter table public.roles add constraint roles_template_key_check
  check (template_key in ('owner','admin','sales_manager','support_manager','ops_manager','agent','viewer'));

insert into public.role_template_permissions (template_key, permission, scope)
select 'admin', permission, scope from public.role_template_permissions where template_key = 'owner';

-- 2. "Owner-only" permissions now mean "owner and admin": still never on a custom role.
create or replace function public.guard_owner_only_permissions()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.scope <> 'none'
     and (select p.owner_only from public.permissions p where p.key = new.permission)
     and not (select r.is_owner or coalesce(r.template_key = 'admin', false) from public.roles r where r.id = new.role_id) then
    raise exception 'Permission % is for the owner and admins only', new.permission using errcode = '42501';
  end if;
  return new;
end $$;

-- 3. Only an owner may change anything about an owner: their role, their status, or making someone one.
create function public.is_owner(p_workspace uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.members m join public.roles r on r.id = m.role_id
    where m.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active' and r.is_owner
  )
$$;

create function public.guard_owner_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  touches_owner boolean;
begin
  if auth.uid() is null or coalesce(current_setting('app.accepting_invite', true), 'off') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'DELETE' then
    touches_owner := (select r.is_owner from public.roles r where r.id = old.role_id);
  else
    touches_owner := (new.role_id is distinct from old.role_id or new.status is distinct from old.status)
      and ((select r.is_owner from public.roles r where r.id = old.role_id)
        or (select r.is_owner from public.roles r where r.id = new.role_id));
  end if;
  if touches_owner and not public.is_owner(old.workspace_id) then
    raise exception 'Only an owner can change or remove an owner' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
create trigger members_owner_changes
  before update or delete on public.members
  for each row execute function public.guard_owner_changes();

create function public.guard_owner_invites()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null
     and (select r.is_owner from public.roles r where r.id = new.role_id)
     and not public.is_owner(new.workspace_id) then
    raise exception 'Only an owner can invite another owner' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger invites_owner_only
  before insert or update on public.invites
  for each row execute function public.guard_owner_invites();

-- 4. New workspaces get the Admin role; existing ones get it now.
create or replace function public.create_workspace(p_name text, p_slug text, p_display_name text)
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
    (ws, 'admin',           'Admin',              'admin',           false),
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

insert into public.roles (workspace_id, key, name, template_key, is_owner)
select w.id, 'admin', 'Admin', 'admin', false
from public.workspaces w
where not exists (select 1 from public.roles r where r.workspace_id = w.id and r.key = 'admin');

insert into public.role_permissions (workspace_id, role_id, permission, scope)
select r.workspace_id, r.id, t.permission, t.scope
from public.roles r
join public.role_template_permissions t on t.template_key = 'admin'
where r.template_key = 'admin'
  and not exists (select 1 from public.role_permissions rp where rp.role_id = r.id and rp.permission = t.permission);

revoke execute on function public.guard_owner_changes(), public.guard_owner_invites() from public, anon, authenticated;
revoke execute on function public.is_owner(uuid) from anon;
