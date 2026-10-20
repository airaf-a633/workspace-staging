-- "Continue with Google": finishing the sign-in, the minute-by-minute check, and replying in the Gmail thread.
-- Seed: khalid ...01 owner, sara ...02 sales manager.
begin;
select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('p', public.start_mail_connection((select v from ids where k = 'ws')::uuid, 'gmail', 'Support@Qamar.example', repeat('g', 40))::text);
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.finish_gmail_channel((select v from ids where k = 'p')::uuid, 'Gmail') $$, 'P0002', 'expired', 'someone else cannot finish Khalid''s sign-in');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids values ('ch', public.finish_gmail_channel((select v from ids where k = 'p')::uuid, 'Support (Gmail)')::text) $$, 'the owner connects the Gmail mailbox they signed in with');
reset role;
select is((select external_id from public.channels where id = (select v from ids where k = 'ch')::uuid), 'gmail:support@qamar.example', 'one channel per Gmail mailbox');
select is((select settings ->> 'provider' from public.channels where id = (select v from ids where k = 'ch')::uuid), 'gmail', 'it is a Gmail email channel');

-- Starting point not set yet: the worker is asked to set it up
select is((select renew from public.mail_connections_due() where channel_id = (select v from ids where k = 'ch')::uuid), true, 'a new Gmail mailbox is set up first');
select public.set_mail_delta((select v from ids where k = 'ch')::uuid, '12345');
select is((select count(*)::int from public.mail_connections_due() where channel_id = (select v from ids where k = 'ch')::uuid), 0, 'just checked: nothing due');
update public.mail_connections set last_sync_at = now() - interval '2 minutes' where channel_id = (select v from ids where k = 'ch')::uuid;
select is((select renew from public.mail_connections_due() where channel_id = (select v from ids where k = 'ch')::uuid), false, 'a minute later: due for a check, no renewal needed');

-- Replies go into the customer's Gmail thread
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<g1@mail.example>', 'text', 'Hello', null, '{"gmailThreadId": "18f2a"}', null, now(), '<g1@mail.example>', 'Hello');
update public.conversations set holder_member_id = (select id from public.members where user_id = '10000000-0000-0000-0000-000000000001') where channel_id = (select v from ids where k = 'ch')::uuid;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('reply', public.send_reply((select id from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid), 'Hi Mariam', 'client-gmail-1')::text);
reset role;
select is((select thread_id from public.outbound_gmail((select v from ids where k = 'reply')::uuid)), '18f2a', 'the reply joins the customer''s Gmail thread');

select * from finish();
rollback;
