-- LINE: block and unblock lines in the chat.
-- Seed: khalid ...01 owner, hana ...05 agent.
begin;
select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar')),
                       ('deira', (select id::text from public.teams where name = 'Deira shop'));
insert into public.channels (workspace_id, type, name, external_id, team_id, settings)
values ((select v from ids where k = 'ws')::uuid, 'line', 'LINE', 'Uline19', (select v from ids where k = 'deira')::uuid, '{}');
insert into ids select 'ch', id::text from public.channels where external_id = 'Uline19';
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'line', 'Ucustomer19', 'Mika', 'Uline19:m1', 'text', 'Hello', null, '{}', null, now());
insert into ids select 'conv', id::text from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid;

select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_blocked', 'line', 'Ucustomer19');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_blocked'), 1, 'a block is written to the chat');
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_blocked', 'line', 'Ucustomer19');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_blocked'), 1, 'the same block twice is written once');
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_unblocked', 'line', 'Ucustomer19');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_unblocked'), 1, 'adding the account again is written');
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_blocked', 'line', 'Ucustomer19');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_blocked'), 2, 'a later block is written again');

select lives_ok($$ select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_blocked', 'line', 'Unobody') $$, 'a block from someone with no chat is ignored');
select throws_ok($$ select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'resolved', 'line', 'Ucustomer19') $$, '22023', 'bad_kind', 'only block and unblock can be written this way');

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_blocked', 'line', 'Ucustomer19') $$, '42501', null, 'nobody signed in can write these lines');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.conversation_events where kind = 'customer_blocked'), 2, 'the team can read them');
reset role;

select * from finish();
rollback;
