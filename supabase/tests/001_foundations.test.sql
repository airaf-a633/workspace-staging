-- M1 foundations: isolation, the approved permission table, and the guards.
begin;
select plan(28);

-- Test users (created as the database owner, before switching to app roles)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'khalid@qamar.test'),
  ('00000000-0000-0000-0000-00000000000b', 'sara@qamar.test'),
  ('00000000-0000-0000-0000-00000000000c', 'omar@qamar.test'),
  ('00000000-0000-0000-0000-00000000000d', 'outsider@other.test');

create function pg_temp.act_as(p_user uuid, p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'email', p_email, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- 1. Catalogue matches the approved table
select is((select count(*)::int from public.permissions), 41, 'catalogue has 41 permissions');
select is((select count(*)::int from public.role_template_permissions), 41 * 6, 'every template has every permission');
select is((select scope::text from public.role_template_permissions where template_key = 'support_manager' and permission = 'deals.values'), 'none', 'support managers cannot see deal values');
select is((select scope::text from public.role_template_permissions where template_key = 'agent' and permission = 'deals.values'), 'own', 'agents see their own deal values');
select is((select scope::text from public.role_template_permissions where template_key = 'agent' and permission = 'contacts.view'), 'all', 'agents can look up all contacts');
select is((select scope::text from public.role_template_permissions where template_key = 'viewer' and permission = 'conversations.reply'), 'none', 'viewers cannot reply');
select ok(not exists (
  select 1 from public.role_template_permissions t join public.permissions p on p.key = t.permission
  where p.owner_only and t.template_key <> 'owner' and t.scope <> 'none'
), 'no owner-only permission is granted to a non-owner template');

-- 2. Owner creates a workspace
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'khalid@qamar.test');
select lives_ok($$ select public.create_workspace('Qamar Electronics', 'qamar', 'Khalid') $$, 'owner creates a workspace');
select is((select count(*)::int from public.roles), 6, 'workspace gets six role templates');
select is((select count(*)::int from public.teams where is_default), 1, 'workspace gets a default team');
select ok(public.has_permission((select id from public.workspaces where slug = 'qamar'), 'audit.read'), 'owner can read the audit log');
select ok((select count(*) from public.audit_log) > 0, 'setup was written to the audit log');

-- Owner invites Sara (sales manager) and Omar (agent)
create temp table tokens (who text, token text) on commit drop;
grant all on tokens to authenticated;
insert into tokens select 'sara', public.create_invite((select id from public.workspaces where slug = 'qamar'), 'Sara@Qamar.test', (select id from public.roles where key = 'sales_manager'));
insert into tokens select 'omar', public.create_invite((select id from public.workspaces where slug = 'qamar'), 'omar@qamar.test', (select id from public.roles where key = 'agent'));

-- 3. Invites
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'outsider@other.test');
select throws_ok($$ select public.accept_invite((select token from tokens where who = 'sara'), 'Mallory') $$, '42501', null, 'an invite cannot be used by a different email');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000b', 'sara@qamar.test');
select lives_ok($$ select public.accept_invite((select token from tokens where who = 'sara'), 'Sara') $$, 'Sara accepts her invite');
select throws_ok($$ select public.accept_invite((select token from tokens where who = 'sara'), 'Sara') $$, '22023', null, 'an invite works only once');

reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000c', 'omar@qamar.test');
select lives_ok($$ select public.accept_invite((select token from tokens where who = 'omar'), 'Omar') $$, 'Omar accepts his invite');

-- 4. What an agent can and cannot do
select is(public.permission_scope((select id from public.workspaces where slug = 'qamar'), 'deals.values')::text, 'own', 'Omar (agent) sees only his own deal values');
select is((select count(*)::int from public.audit_log), 0, 'agents cannot read the audit log');
select is((select count(*)::int from public.members), 3, 'agents see their colleagues');
select throws_ok($$ update public.members set role_id = (select id from public.roles where key = 'owner') where user_id = auth.uid() $$,
  '42501', null, 'an agent cannot promote himself');
select lives_ok($$ update public.members set display_name = 'Omar K.' where user_id = auth.uid() $$, 'an agent can edit his own name');
select throws_ok($$ select public.create_invite((select id from public.workspaces where slug = 'qamar'), 'x@qamar.test', (select id from public.roles where key = 'agent')) $$,
  '42501', null, 'an agent cannot invite members');

-- 5. Isolation between workspaces
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000d', 'outsider@other.test');
select is((select count(*)::int from public.workspaces), 0, 'an outsider sees no workspaces');
select is((select count(*)::int from public.members), 0, 'an outsider sees no members');

-- 6. Guards (as the owner)
reset role;
select pg_temp.act_as('00000000-0000-0000-0000-00000000000a', 'khalid@qamar.test');
select throws_ok($$ update public.members set role_id = (select id from public.roles where key = 'agent') where user_id = auth.uid() $$,
  '42501', null, 'the last owner cannot be demoted');

select lives_ok($$ insert into public.roles (workspace_id, key, name) values ((select id from public.workspaces where slug = 'qamar'), 'branch_lead', 'Branch lead') $$,
  'the owner can create a custom role');
select throws_ok($$ insert into public.role_permissions (workspace_id, role_id, permission, scope)
  values ((select id from public.workspaces where slug = 'qamar'), (select id from public.roles where key = 'branch_lead'), 'contacts.erase', 'all') $$,
  '42501', null, 'owner-only permissions cannot be given to a custom role');
select throws_ok($$ delete from public.audit_log $$, '42501', null, 'the audit log cannot be deleted');

select * from finish();
rollback;
