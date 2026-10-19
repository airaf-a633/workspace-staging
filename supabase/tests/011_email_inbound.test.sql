-- Email, receiving: creating the channel, the forwarding token, and threading by References.
-- Seed: khalid ...01 owner, hana ...05 agent.
begin;
select plan(10);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.create_email_channel((select v from ids where k = 'ws')::uuid, 'Support', 'support@qamar.example', null, null) $$,
  '42501', 'not_allowed', 'an agent cannot add an email channel');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.create_email_channel((select v from ids where k = 'ws')::uuid, 'Support', 'not an email', null, null) $$,
  '22023', 'bad_address', 'the business address must look like an email');
select lives_ok($$ insert into ids values ('ch', public.create_email_channel((select v from ids where k = 'ws')::uuid, 'Support', 'Support@Qamar.example', 'Qamar Support', 'Qamar Electronics, Deira')::text) $$,
  'the owner adds an email channel');
reset role;
insert into ids select 'token', external_id from public.channels where id = (select v from ids where k = 'ch')::uuid;
select ok((select v from ids where k = 'token') ~ '^qamar-[0-9a-f]{6}$', 'the forwarding token is readable and unguessable');
select is((select settings ->> 'address' from public.channels where id = (select v from ids where k = 'ch')::uuid), 'support@qamar.example', 'the business address is kept in lower case');
select is(public.email_channel_by_token(upper((select v from ids where k = 'token'))), (select v from ids where k = 'ch')::uuid, 'the worker finds the channel by token, any case');

-- Threading
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<root@mail.example>', 'text', 'Where is my order?', null, '{}', null, now(), '<root@mail.example>', 'Order 4821');
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<b@mail.example>', 'text', 'Any news?', null, '{}', '<root@mail.example>', now(), '<root@mail.example>', 'Re: Order 4821');
select is(public.email_thread_for((select v from ids where k = 'ch')::uuid, array['<root@mail.example>']), '<root@mail.example>', 'a reply naming the first email joins its thread');
select is(public.email_thread_for((select v from ids where k = 'ch')::uuid, array['<unknown@x>', '<b@mail.example>']), '<root@mail.example>', 'a reply naming any email in the thread joins it');
select is(public.email_thread_for((select v from ids where k = 'ch')::uuid, array['<new@x>']), null, 'an email naming nothing we know starts a new thread');

-- Changing the address resets verification
update public.channels set settings = settings || '{"domainVerified": true}' where id = (select v from ids where k = 'ch')::uuid;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.update_email_channel((select v from ids where k = 'ch')::uuid, 'Support', 'help@qamar.example', 'Qamar Support', null);
reset role;
select is((select settings ->> 'domainVerified' from public.channels where id = (select v from ids where k = 'ch')::uuid), 'false', 'a new address must be verified again');

select * from finish();
rollback;
