-- "Continue with Outlook": sign-in handover, picking the mailbox, the worker's side, and keeping secrets secret.
-- Seed: khalid ...01 owner, sara ...02 sales manager, hana ...05 agent.
begin;
select plan(15);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.start_mail_connection((select v from ids where k = 'ws')::uuid, 'outlook', 'hana@qamar.example', repeat('r', 40)) $$,
  '42501', 'not_allowed', 'an agent cannot connect a mailbox');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids values ('p', public.start_mail_connection((select v from ids where k = 'ws')::uuid, 'outlook', 'Khalid@Qamar.example', repeat('r', 40))::text) $$,
  'the owner signs in with Microsoft');
select is(public.pending_mail_account((select v from ids where k = 'p')::uuid), 'khalid@qamar.example', 'the picker knows who signed in');
select throws_ok($$ select * from public.oauth_pending $$, '42501', null, 'app users cannot read pending sign-ins');
reset role;

-- Someone else can't finish Khalid's sign-in
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is(public.pending_mail_account((select v from ids where k = 'p')::uuid), null, 'another person sees nothing of it');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids values ('ch', public.finish_outlook_channel((select v from ids where k = 'p')::uuid, 'Support@Qamar.example', 'Support (Outlook)')::text) $$,
  'the owner picks the shared support mailbox');
select is((select settings ->> 'provider' from public.channels where id = (select v from ids where k = 'ch')::uuid), 'outlook', 'it is an Outlook email channel');
select is((select external_id from public.channels where id = (select v from ids where k = 'ch')::uuid), 'outlook:support@qamar.example', 'one channel per mailbox');
select throws_ok($$ select * from public.mail_connections $$, '42501', null, 'app users cannot read the connection or its token');
reset role;

select is((select count(*)::int from public.oauth_pending), 0, 'the pending sign-in is used up');
select is((select count(*)::int from public.jobs where queue = 'mail_subscribe' and payload ->> 'channel_id' = (select v from ids where k = 'ch')), 1, 'the worker is asked to start listening');

-- The worker's side
select is((select refresh_token from public.mail_connection((select v from ids where k = 'ch')::uuid)), repeat('r', 40), 'the worker reads the refresh token');
select public.set_mail_subscription((select v from ids where k = 'ch')::uuid, 'sub-1', now() + interval '2 days');
select is(public.mail_subscription_channel('sub-1', (select client_state from public.mail_connections where channel_id = (select v from ids where k = 'ch')::uuid)),
  (select v from ids where k = 'ch')::uuid, 'a notification with the right secret finds its channel');
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<o1@mail.example>', 'text', 'Hello', null, '{"graphId": "AAMk-1"}', null, now(), '<o1@mail.example>', 'Hello');
update public.conversations set holder_member_id = (select id from public.members where user_id = '10000000-0000-0000-0000-000000000001') where channel_id = (select v from ids where k = 'ch')::uuid;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('reply', public.send_reply((select id from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid), 'Hi Mariam', 'client-outlook-1')::text);
reset role;
select is((select graph_id from public.outbound_outlook((select v from ids where k = 'reply')::uuid)), 'AAMk-1', 'the worker replies to the customer''s latest email in Outlook');
select public.mark_mail_broken((select v from ids where k = 'ch')::uuid, 'Access was revoked');
select is((select status from public.channels where id = (select v from ids where k = 'ch')::uuid), 'disconnected', 'a broken connection shows Reconnect, history kept');

select * from finish();
rollback;
