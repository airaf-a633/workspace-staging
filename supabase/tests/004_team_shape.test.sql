-- The team question: valid answers only, and only the owner can set it.
begin;
select plan(4);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001'); -- Khalid, owner of qamar
select lives_ok($$ update public.workspaces set team_shape = 'split' where slug = 'qamar' $$, 'the owner answers the team question');
select is((select team_shape from public.workspaces where slug = 'qamar'), 'split', 'the answer is saved');
select throws_ok($$ update public.workspaces set team_shape = 'huge' where slug = 'qamar' $$, '23514', null, 'only the four answers are allowed');

reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005'); -- Hana, agent
update public.workspaces set team_shape = 'solo' where slug = 'qamar';
reset role;
select is((select team_shape from public.workspaces where slug = 'qamar'), 'split', 'an agent cannot change it');

select * from finish();
rollback;
