-- M2.2 / M2.3: connecting a number, receiving messages, and who can see them.
-- Seed: khalid ...01 owner, sara ...02 sales (Deira), omar ...03 support (Mall), hana ...05 agent (Deira),
-- aisha ...06 viewer (Mall), noor ...07 another business.
begin;
select plan(17);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id from public.workspaces where slug = 'qamar')),
  ('mall', (select id from public.teams where name = 'Dubai Mall shop'));

-- Connecting: owner only, token never readable
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.connect_whatsapp_account((select v from ids where k = 'ws'), '1111111111', '2222222222', '+971 4 555 0190', 'Qamar', 'GREEN', 'x'||repeat('t', 40), true) $$,
  '42501', null, 'a support manager cannot connect a number');

reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids values ('acc', public.connect_whatsapp_account((select v from ids where k = 'ws'), '1111111111', '2222222222', '+971 4 555 0190', 'Qamar', 'GREEN', 'x'||repeat('t', 40), true)) $$,
  'the owner connects the test number');
select throws_ok($$ select token_secret_id from public.whatsapp_accounts $$, '42501', null, 'the token column is not readable by app users');
select is((select display_phone from public.whatsapp_accounts where id = (select v from ids where k = 'acc')), '+971 4 555 0190', 'the owner sees the number');
select throws_ok($$ select public.whatsapp_token((select v from ids where k = 'acc')) $$, '42501', null, 'app users cannot read the token');

-- Receiving (as the worker)
reset role;
update public.channels set team_id = (select v from ids where k = 'mall') where id = (select v from ids where k = 'acc');
select isnt(public.ingest_inbound((select v from ids where k = 'acc'), 'whatsapp', '971501234567', 'Mariam', 'wamid.A', 'text', 'Hello', null, '{}', null, now() - interval '2 minutes'),
  null, 'the first message is stored');
select is(public.ingest_inbound((select v from ids where k = 'acc'), 'whatsapp', '971501234567', 'Mariam', 'wamid.A', 'text', 'Hello', null, '{}', null, now() - interval '2 minutes'),
  null, 'the same message id again is skipped');
select isnt(public.ingest_inbound((select v from ids where k = 'acc'), 'whatsapp', '971501234567', 'Mariam', 'wamid.B', 'text', 'Are you there?', null, '{}', null, now()),
  null, 'a second message is stored');
select is((select count(*)::int from public.conversations where channel_id = (select v from ids where k = 'acc')), 1, 'one conversation per customer per number');
select is((select unread_count from public.conversations where channel_id = (select v from ids where k = 'acc')), 2, 'both messages count as unread');
select ok(public.apply_reaction((select v from ids where k = 'acc'), 'wamid.A', '👍'), 'a reaction attaches to its message');

-- Statuses only move forward
insert into public.messages (workspace_id, conversation_id, external_id, direction, source, type, body, status, sent_at)
select (select v from ids where k = 'ws'), id, 'wamid.OUT', 'out', 'inbox', 'text', 'Yes!', 'sent', now() from public.conversations where channel_id = (select v from ids where k = 'acc');
select public.apply_message_status((select v from ids where k = 'acc'), 'wamid.OUT', 'read');
select public.apply_message_status((select v from ids where k = 'acc'), 'wamid.OUT', 'delivered');
select is((select status from public.messages where external_id = 'wamid.OUT'), 'read', 'a late "delivered" does not overwrite "read"');

-- Visibility follows conversations.view
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.messages where external_id in ('wamid.A', 'wamid.B')), 2, 'Omar (Mall team) sees the Mall chat');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.messages where external_id in ('wamid.A', 'wamid.B')), 2, 'Aisha (viewer, Mall) can read it');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.messages where external_id in ('wamid.A', 'wamid.B')), 0, 'Sara (Deira team) cannot see a Mall chat');
select throws_ok($$ insert into public.messages (workspace_id, conversation_id, direction, type, sent_at) values ((select v from ids where k = 'ws'), gen_random_uuid(), 'out', 'text', now()) $$,
  '42501', null, 'app users cannot write messages directly');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.contact_identities where address = '971501234567'), 0, 'another business sees none of it');

select * from finish();
rollback;
