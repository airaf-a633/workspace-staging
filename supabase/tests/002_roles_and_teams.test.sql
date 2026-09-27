-- Custom roles and teams, using the seed data (Qamar Electronics and Noor Salon).
begin;
select plan(12);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

-- Seed users
-- khalid ...01 owner, sara ...02 sales_manager, omar ...03 support_manager, hana ...05 agent, noor ...07 other business

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id from public.workspaces where slug = 'qamar'));

select lives_ok($$ insert into ids values ('role', public.create_custom_role((select v from ids where k = 'ws'), 'Branch lead', 'sales_manager')) $$,
  'the owner creates a custom role from the sales manager template');
select is((select count(*)::int from public.role_permissions where role_id = (select v from ids where k = 'role')), 41, 'the custom role gets every permission');
select lives_ok($$ update public.role_permissions set scope = 'all' where role_id = (select v from ids where k = 'role') and permission = 'conversations.view' $$,
  'the owner widens a custom role permission');
select is((select scope::text from public.role_permissions where role_id = (select v from ids where k = 'role') and permission = 'conversations.view'), 'all', 'the change is saved');
select throws_ok($$ select public.create_custom_role((select v from ids where k = 'ws'), 'Boss', 'owner') $$, '22023', null, 'a custom role cannot copy the owner');

update public.role_permissions set scope = 'none'
  where permission = 'deals.values' and role_id = (select id from public.roles where workspace_id = (select v from ids where k = 'ws') and key = 'sales_manager');
select is((select scope::text from public.role_permissions where permission = 'deals.values'
  and role_id = (select id from public.roles where workspace_id = (select v from ids where k = 'ws') and key = 'sales_manager')), 'all',
  'template roles cannot be edited (the update is ignored)');

select lives_ok($$ insert into public.teams (workspace_id, name, is_branch) values ((select v from ids where k = 'ws'), 'Online', false) $$,
  'the owner creates a team');

-- Sara (sales manager) manages her own team only
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
update public.teams set name = 'Deira branch' where workspace_id = (select v from ids where k = 'ws') and name = 'Deira shop';
select is((select count(*)::int from public.teams where name = 'Deira branch'), 1, 'a manager renames a team she belongs to');
update public.teams set name = 'Mall branch' where workspace_id = (select v from ids where k = 'ws') and name = 'Dubai Mall shop';
select is((select count(*)::int from public.teams where name = 'Mall branch'), 0, 'a manager cannot rename another team');
select throws_ok($$ insert into public.teams (workspace_id, name) values ((select v from ids where k = 'ws'), 'Sara team') $$,
  '42501', null, 'a manager cannot create teams');

-- Hana (agent) and the other business
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.create_custom_role((select v from ids where k = 'ws'), 'Mine', 'agent') $$, '42501', null, 'an agent cannot create roles');

reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.teams where workspace_id = (select v from ids where k = 'ws')), 0, 'another business sees none of Qamar''s teams');

select * from finish();
rollback;
