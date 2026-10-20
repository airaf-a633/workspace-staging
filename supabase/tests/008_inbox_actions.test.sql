-- Step 2a: claim, take over, hand over, resolve, spam, notes with mentions, asking to collaborate.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall),
-- hana ...05 agent (Deira), aisha ...06 viewer (Mall), noor ...07 another business.
begin;
select plan(16);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id from public.workspaces where slug = 'qamar')),
  ('deira', (select id from public.teams where name = 'Deira shop')),
  ('mall', (select id from public.teams where name = 'Dubai Mall shop')),
  ('hana', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005'));

-- A Deira chat arrives (as the worker)
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws'), 'webchat', 'Website', 'site-1', (select v from ids where k = 'deira'));
select public.ingest_inbound((select id from public.channels where external_id = 'site-1'), 'webchat', 'visitor-1', 'Lina', 'w-1', 'text', 'Hi', null, '{}', null, now());
insert into ids select 'c', id from public.conversations where channel_id = (select id from public.channels where external_id = 'site-1');

-- Claiming and taking over
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.claim_conversation((select v from ids where k = 'c')) $$, 'Hana (agent) claims an unheld Deira chat');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.claim_conversation((select v from ids where k = 'c')) $$, 'Sara (manager, override) takes it over');
reset role;
select is((select count(*)::int from public.audit_log where action = 'override' and entity_id = (select v from ids where k = 'c')::text), 1, 'the takeover is audited');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.claim_conversation((select v from ids where k = 'c')) $$, '42501', null, 'Hana cannot take back a chat someone else holds');

-- Handing over
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.hand_over_conversation((select v from ids where k = 'c'), null, (select v from ids where k = 'mall'), 'short') $$,
  '22023', null, 'a handoff needs a real note');
select lives_ok($$ select public.hand_over_conversation((select v from ids where k = 'c'), null, (select v from ids where k = 'mall'), 'Customer wants to pick up at the mall') $$,
  'Sara hands it to the Mall team');
select is((select count(*)::int from public.conversations where id = (select v from ids where k = 'c')), 0, 'Sara (Deira) no longer sees it');

-- Notes and mentions
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select lives_ok($$ select public.claim_conversation((select v from ids where k = 'c')) $$, 'Omar (Mall) claims it');
select lives_ok($$ select public.add_conversation_note((select v from ids where k = 'c'), 'Checking stock, @Hana knows this one',
  array[(select v from ids where k = 'hana'), gen_random_uuid()]) $$, 'Omar writes a note');
select is((select cardinality(mentions) from public.conversation_notes where conversation_id = (select v from ids where k = 'c')), 1, 'only real members are kept as mentions');
select lives_ok($$ select public.set_conversation_status((select v from ids where k = 'c'), 'resolved') $$, 'Omar resolves it');
select is((select status from public.conversations where id = (select v from ids where k = 'c')), 'resolved', 'the chat is resolved');

-- Viewers can't change anything, but can ask to collaborate
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.set_conversation_status((select v from ids where k = 'c'), 'spam') $$, '42501', null, 'Aisha (viewer) cannot mark spam');
select lives_ok($$ select public.ask_to_collaborate((select v from ids where k = 'c')) $$, 'Aisha asks to collaborate');

-- Collaborators see the chat
reset role;
insert into public.conversation_collaborators (workspace_id, conversation_id, member_id)
values ((select v from ids where k = 'ws'), (select v from ids where k = 'c'), (select v from ids where k = 'hana'));
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'c')), 6, 'Hana, a collaborator, sees the whole trail');

reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.conversation_notes) + (select count(*)::int from public.conversation_events), 0, 'another business sees none of it');

select * from finish();
rollback;
