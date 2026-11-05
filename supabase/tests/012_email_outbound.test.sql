-- Email, sending: what the worker reads for threading, and domain verification rights.
-- Seed: khalid ...01 owner, hana ...05 agent.
begin;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('ch', public.create_email_channel((select v from ids where k = 'ws')::uuid, 'Support', 'support@qamar.example', 'Qamar Support', 'Qamar Electronics')::text);
reset role;

select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<root@mail.example>', 'text', 'Where is my order?', null, '{}', null, now() - interval '2 hours', '<root@mail.example>', 'Order 4821');
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'email', 'mariam@example.com', 'Mariam', '<second@mail.example>', 'text', 'Any news?', null, '{}', '<root@mail.example>', now() - interval '1 hour', '<root@mail.example>', 'Re: Order 4821');
insert into ids select 'conv', id::text from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid;
update public.conversations set holder_member_id = (select id from public.members where user_id = '10000000-0000-0000-0000-000000000001') where id = (select v from ids where k = 'conv')::uuid;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('reply', public.send_reply((select v from ids where k = 'conv')::uuid, 'It ships today.', 'client-email-01')::text);
reset role;

select is((select subject from public.outbound_email((select v from ids where k = 'reply')::uuid)), 'Order 4821', 'the thread''s subject');
select is((select in_reply_to from public.outbound_email((select v from ids where k = 'reply')::uuid)), '<second@mail.example>', 'In-Reply-To names the customer''s latest email');
select is((select refs from public.outbound_email((select v from ids where k = 'reply')::uuid)), array['<root@mail.example>', '<second@mail.example>'], 'References carry the thread, oldest first');
select is((select sender from public.outbound_email((select v from ids where k = 'reply')::uuid)), 'Khalid', 'the sender''s name, for the From line');
select is((select settings ->> 'signature' from public.outbound_email((select v from ids where k = 'reply')::uuid)), 'Qamar Electronics', 'the channel''s signature');

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.set_email_domain((select v from ids where k = 'ch')::uuid, '{"verified": true}') $$, '42501', 'not_allowed', 'an agent cannot mark a domain verified');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.set_email_domain((select v from ids where k = 'ch')::uuid, '{"id": 42, "name": "qamar.example", "verified": true}');
reset role;
select is((select settings ->> 'domainVerified' from public.channels where id = (select v from ids where k = 'ch')::uuid), 'true', 'the owner''s verified domain switches replies to their address');

select * from finish();
rollback;
