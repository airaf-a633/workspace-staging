-- Removes the seed test businesses and people (Qamar Electronics, Noor Salon and the seven *.test accounts with the known password
-- Password1234) from a database that is about to hold real pilots. Decided 2026-11-05: the staging project becomes the pilot's database.
-- Run it ONCE, in the Supabase SQL editor, AFTER the live browser tests (they sign in as these people) and BEFORE any pilot signs up.
-- It runs as one transaction and refuses to finish (everything rolls back) if anything of the seed is left.
--
-- Guards that would stop a deletion, by design: "a business must keep an owner", the owner-change guard, and "the audit log is
-- append-only". The triggers that write audit rows are also switched off, because deleting a business would otherwise try to
-- write audit rows about the business being deleted. All of them are switched off for this transaction only and switched back on
-- before it ends. Foreign keys still cascade normally.
begin;

alter table public.members disable trigger members_last_owner;
alter table public.members disable trigger members_owner_changes;
alter table public.audit_log disable trigger audit_log_append_only;
alter table public.members disable trigger audit_members;
alter table public.roles disable trigger audit_roles;
alter table public.role_permissions disable trigger audit_role_permissions;
alter table public.team_members disable trigger audit_team_members;
alter table public.invites disable trigger audit_invites;

delete from public.workspaces where slug in ('qamar', 'noor');
delete from auth.identities where user_id in (select id from auth.users where email like '%@qamar.test' or email like '%@noor.test');
delete from auth.users where email like '%@qamar.test' or email like '%@noor.test';

alter table public.members enable trigger members_last_owner;
alter table public.members enable trigger members_owner_changes;
alter table public.audit_log enable trigger audit_log_append_only;
alter table public.members enable trigger audit_members;
alter table public.roles enable trigger audit_roles;
alter table public.role_permissions enable trigger audit_role_permissions;
alter table public.team_members enable trigger audit_team_members;
alter table public.invites enable trigger audit_invites;

do $$
begin
  if exists (select 1 from auth.users where email like '%@qamar.test' or email like '%@noor.test')
     or exists (select 1 from public.workspaces where slug in ('qamar', 'noor')) then
    raise exception 'Seed data is still there; nothing was changed';
  end if;
  if (select count(*) from pg_trigger where tgname in ('members_last_owner', 'members_owner_changes', 'audit_log_append_only', 'audit_members', 'audit_roles', 'audit_role_permissions', 'audit_team_members', 'audit_invites') and tgenabled = 'O') <> 8 then
    raise exception 'A guard was left switched off; nothing was changed';
  end if;
end $$;

commit;
