-- Website chat: creating the channel, visitors writing and reading, replies, and the guard rails.
-- Seed: khalid ...01 owner, hana ...05 agent (Deira), noor ...07 another business.
begin;
select plan(14);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id::text from public.workspaces where slug = 'qamar')),
  ('v1', repeat('a', 64)), ('v2', repeat('b', 64));

-- Only owners and admins create it
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.create_webchat_channel((select v from ids where k = 'ws')::uuid, 'Website', '{}') $$, '42501', 'not_allowed', 'an agent cannot add website chat');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids values ('ch', public.create_webchat_channel((select v from ids where k = 'ws')::uuid, 'Website', '{"color":"#006ACC","greeting":"Hi!"}')::text) $$, 'the owner adds website chat');
reset role;
insert into ids select 'key', external_id from public.channels where id = (select v from ids where k = 'ch')::uuid;
select ok((select v from ids where k = 'key') ~ '^[0-9a-f]{32}$', 'the widget gets a random public key');
select is((select settings ->> 'greeting' from public.webchat_config((select v from ids where k = 'key'))), 'Hi!', 'the widget reads its greeting by key');

-- Visitors write and read
select isnt(public.webchat_send((select v from ids where k = 'key'), (select v from ids where k = 'v1'), 'client-aaaa-0001', 'Do you ship to Dubai?', 'Lina', 'Lina@Example.com'), null, 'a visitor sends a message');
select is(public.webchat_send((select v from ids where k = 'key'), (select v from ids where k = 'v1'), 'client-aaaa-0001', 'Do you ship to Dubai?'),
  (select id from public.messages where external_id = 'wc:client-aaaa-0001'), 'the same message twice is stored once');
select is((select email from public.contacts c join public.contact_identities i on i.contact_id = c.id where i.address = (select v from ids where k = 'v1')), 'lina@example.com', 'the email the visitor gave is kept, in lower case');
select is((select count(*)::int from public.webchat_thread((select v from ids where k = 'key'), (select v from ids where k = 'v2'))), 0, 'another visitor sees nothing of it');

-- The team replies; the visitor sees it and it turns read
insert into ids select 'conv', conversation_id::text from public.messages where external_id = 'wc:client-aaaa-0001';
update public.conversations set holder_member_id = (select id from public.members where user_id = '10000000-0000-0000-0000-000000000001') where id = (select v from ids where k = 'conv')::uuid;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('reply', public.send_reply((select v from ids where k = 'conv')::uuid, 'Yes, 2 to 3 days.', 'client-reply-01')::text);
reset role;
select is((select count(*)::int from public.webchat_thread((select v from ids where k = 'key'), (select v from ids where k = 'v1'))), 1, 'a reply still in the queue is not shown yet');
select public.mark_message_sent((select v from ids where k = 'reply')::uuid, 'wc:out-1');
select is((select count(*)::int from public.webchat_thread((select v from ids where k = 'key'), (select v from ids where k = 'v1')) where not mine), 1, 'once sent, the visitor sees the reply');
select is((select status from public.messages where id = (select v from ids where k = 'reply')::uuid), 'read', 'opening the widget marks the reply read');

-- Guard rails
select throws_ok($$ select public.webchat_send((select v from ids where k = 'key'), 'not-a-fingerprint', 'client-aaaa-0002', 'hi') $$, '22023', 'bad_visitor', 'a malformed visitor is refused');
do $$ begin
  for i in 2..10 loop perform public.webchat_send((select v from ids where k = 'key'), (select v from ids where k = 'v1'), 'client-flood-' || lpad(i::text, 4, '0'), 'spam'); end loop;
end $$;
select throws_ok($$ select public.webchat_send((select v from ids where k = 'key'), (select v from ids where k = 'v1'), 'client-flood-0011', 'spam') $$, 'P0001', 'rate_limited', 'more than 10 a minute is refused');
select throws_ok($$ select public.webchat_send('0000000000000000ffffffffffffffff', (select v from ids where k = 'v1'), 'client-aaaa-0003', 'hi') $$, 'P0002', 'unknown_widget', 'an unknown widget key is refused');

select * from finish();
rollback;
