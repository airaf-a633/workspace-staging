-- Custom roles: created as a copy of a template, then adjusted. The six templates stay fixed.
-- Plan gating (custom roles on Growth and up) is added with billing in M10.

create function public.create_custom_role(p_workspace uuid, p_name text, p_from_template text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_role uuid;
  base_key text;
begin
  if not public.has_permission(p_workspace, 'members.manage') then
    raise exception 'Only the owner can create roles' using errcode = '42501';
  end if;
  if p_from_template not in ('sales_manager','support_manager','ops_manager','agent','viewer') then
    raise exception 'Start from a non-owner role template' using errcode = '22023';
  end if;

  base_key := left(regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '_', 'g'), 30);
  base_key := trim(both '_' from base_key);
  if length(base_key) < 2 then base_key := 'role'; end if;

  insert into public.roles (workspace_id, key, name)
  values (p_workspace, base_key || '_' || substr(md5(random()::text), 1, 6), trim(p_name))
  returning id into new_role;

  insert into public.role_permissions (workspace_id, role_id, permission, scope)
  select p_workspace, new_role, t.permission, t.scope
  from public.role_template_permissions t
  where t.template_key = p_from_template;

  return new_role;
end $$;

-- Only custom roles can have their permissions changed.
drop policy role_permissions_write on public.role_permissions;
create policy role_permissions_write on public.role_permissions for all to authenticated
  using (
    (select public.has_permission(workspace_id, 'members.manage'))
    and exists (select 1 from public.roles r where r.id = role_id and r.template_key is null)
  )
  with check (
    (select public.has_permission(workspace_id, 'members.manage'))
    and exists (select 1 from public.roles r where r.id = role_id and r.template_key is null)
  );

-- Template roles can't be renamed or deleted; custom roles can, unless members still use them
-- (the members foreign key blocks deleting a role in use).
drop policy roles_write on public.roles;
create policy roles_insert on public.roles for insert to authenticated
  with check ((select public.has_permission(workspace_id, 'members.manage')) and not is_owner and template_key is null);
create policy roles_update on public.roles for update to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')) and template_key is null)
  with check (not is_owner and template_key is null);
create policy roles_delete on public.roles for delete to authenticated
  using ((select public.has_permission(workspace_id, 'members.manage')) and template_key is null);

revoke execute on function public.create_custom_role(uuid, text, text) from anon;
