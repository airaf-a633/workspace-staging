-- Admin role (2026-10-07): the owner's permissions, but nothing about owners themselves.
begin;
select plan(11);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- Seed users: khalid ...01 owner, sara ...02 sales manager (made admin below), omar ...03 support manager, hana ...05 agent
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id from public.workspaces where slug = 'qamar')),
  ('owner', (select id from public.roles r where r.workspace_id = (select id from public.workspaces where slug = 'qamar') and r.key = 'owner')),
  ('admin', (select id from public.roles r where r.workspace_id = (select id from public.workspaces where slug = 'qamar') and r.key = 'admin')),
  ('agent', (select id from public.roles r where r.workspace_id = (select id from public.workspaces where slug = 'qamar') and r.key = 'agent'));

select is((select count(*)::int from public.role_template_permissions where template_key = 'admin'), 41, 'the admin template has every permission');
select ok((select v from ids where k = 'admin') is not null, 'every workspace has an Admin role');

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ update public.members set role_id = (select v from ids where k = 'admin') where user_id = '10000000-0000-0000-0000-000000000002' $$,
  'the owner makes Sara an admin');

reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select ok(public.has_permission((select v from ids where k = 'ws'), 'numbers.manage'), 'an admin manages channels');
select ok(public.has_permission((select v from ids where k = 'ws'), 'billing.manage'), 'an admin manages billing');
select lives_ok($$ update public.members set role_id = (select v from ids where k = 'agent') where user_id = '10000000-0000-0000-0000-000000000003' $$,
  'an admin changes another member''s role');
select throws_ok($$ update public.members set role_id = (select v from ids where k = 'owner') where user_id = '10000000-0000-0000-0000-000000000005' $$,
  '42501', null, 'an admin cannot make someone an owner');
select throws_ok($$ update public.members set status = 'removed', removed_at = now() where user_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'an admin cannot remove the owner');
select throws_ok($$ update public.members set role_id = (select v from ids where k = 'agent') where user_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'an admin cannot demote the owner');
select throws_ok($$ select public.create_invite((select v from ids where k = 'ws'), 'boss@unit.test', (select v from ids where k = 'owner')) $$,
  '42501', null, 'an admin cannot invite another owner');

-- Owner-only permissions still never reach a custom role.
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('custom', public.create_custom_role((select v from ids where k = 'ws'), 'Night lead', 'support_manager'));
select throws_ok($$ update public.role_permissions set scope = 'all' where role_id = (select v from ids where k = 'custom') and permission = 'numbers.manage' $$,
  '42501', null, 'a custom role still cannot hold an owner-and-admin permission');

select * from finish();
rollback;
