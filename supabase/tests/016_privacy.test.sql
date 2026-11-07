-- Step 2c: consent, do-not-contact, merging, erasing and import.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), hana ...05 agent (Deira), aisha ...06 viewer, noor ...07 another business.
begin;
select plan(24);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id::text from public.workspaces where slug = 'qamar')),
  ('deira', (select id::text from public.teams where name = 'Deira shop'));

-- Mariam writes twice: once on website chat, once by email (two customers until merged)
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws')::uuid, 'webchat', 'Site', 'k16', (select v from ids where k = 'deira')::uuid),
       ((select v from ids where k = 'ws')::uuid, 'email', 'Support', 'e16', (select v from ids where k = 'deira')::uuid);
select public.ingest_inbound((select id from public.channels where external_id = 'k16'), 'webchat', repeat('d', 64), 'Mariam', 'wc:16a', 'text', 'Hi from the site', null, '{}', null, now() - interval '1 hour');
select public.ingest_inbound((select id from public.channels where external_id = 'e16'), 'email', 'mariam@example.com', 'Mariam Haddad', '<m16@x>', 'text', 'Hi by email', null, '{}', null, now(), '<m16@x>', 'Order');
insert into ids select 'web', contact_id::text from public.contact_identities where address = repeat('d', 64);
insert into ids select 'mail', contact_id::text from public.contact_identities where address = 'mariam@example.com';

-- Consent
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.set_consent((select v from ids where k = 'mail')::uuid, 'email', 'in', 'Asked on the phone') $$, 'Hana records email consent');
reset role;
select is((select status from public.contact_consent where contact_id = (select v from ids where k = 'mail')::uuid and channel = 'email'), 'in', 'consent is stored');
select is((select source from public.contact_consent where contact_id = (select v from ids where k = 'mail')::uuid), 'Asked on the phone', 'with where it came from');
select is((select count(*)::int from public.audit_log where action = 'consent'), 1, 'and goes in the audit log');
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.set_consent((select v from ids where k = 'mail')::uuid, 'email', 'out', 'x') $$, '42501', 'not_allowed', 'a Viewer cannot change consent');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.set_do_not_contact((select v from ids where k = 'mail')::uuid, true) $$, 'Hana marks do-not-contact');
reset role;

-- Merging: Sara keeps the email customer
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.merge_contacts((select v from ids where k = 'mail')::uuid, (select v from ids where k = 'web')::uuid) $$, '42501', 'not_allowed', 'an Agent cannot merge');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.merge_contacts((select v from ids where k = 'mail')::uuid, (select v from ids where k = 'web')::uuid, '{}') $$, 'Sara merges the two');
reset role;
select is((select count(*)::int from public.contacts where id = (select v from ids where k = 'web')::uuid), 0, 'the duplicate is gone');
select is((select count(*)::int from public.contact_identities where contact_id = (select v from ids where k = 'mail')::uuid), 2, 'both ways to reach her are on one customer');
select is((select count(*)::int from public.conversations where contact_id = (select v from ids where k = 'mail')::uuid), 2, 'both chats belong to her');
select is((select do_not_contact from public.contacts where id = (select v from ids where k = 'mail')::uuid), true, 'do-not-contact survives the merge');

-- Two chats on the same channel join into one
select public.ingest_inbound((select id from public.channels where external_id = 'k16'), 'webchat', repeat('e', 64), 'Visitor', 'wc:16b', 'text', 'Second visit', null, '{}', null, now());
insert into ids select 'web2', contact_id::text from public.contact_identities where address = repeat('e', 64);
select public.ingest_inbound((select id from public.channels where external_id = 'k16'), 'webchat', repeat('d', 64), 'Mariam', 'wc:16c', 'text', 'Back again', null, '{}', null, now());
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.merge_contacts((select v from ids where k = 'mail')::uuid, (select v from ids where k = 'web2')::uuid, '{}');
reset role;
select is((select count(*)::int from public.conversations where contact_id = (select v from ids where k = 'mail')::uuid and channel_id = (select id from public.channels where external_id = 'k16')), 1,
  'chats on the same channel join into one');
select is((select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
           where c.contact_id = (select v from ids where k = 'mail')::uuid and c.channel_id = (select id from public.channels where external_id = 'k16')), 3,
  'with every message kept');

-- Erasing
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.erase_contacts(array[(select v from ids where k = 'mail')::uuid]) $$, '42501', 'not_allowed', 'a manager cannot erase');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select is(public.erase_contacts(array[(select v from ids where k = 'mail')::uuid]), 1, 'the owner erases her');
reset role;
select is((select name from public.contacts where id = (select v from ids where k = 'mail')::uuid), 'Erased customer', 'only an anonymous placeholder remains');
select is((select count(*)::int from public.contact_identities where contact_id = (select v from ids where k = 'mail')::uuid), 0, 'no way to reach her remains');
select is((select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id
           where c.contact_id = (select v from ids where k = 'mail')::uuid and m.body is not null), 0, 'no message text remains');
select is((select count(*)::int from public.messages m join public.conversations c on c.id = m.conversation_id where c.contact_id = (select v from ids where k = 'mail')::uuid), 4,
  'but reports still count her messages');

-- Import: fill in blanks, consent only when the file says yes
insert into public.contacts (workspace_id, name, email, created_from, owner_member_id)
  values ((select v from ids where k = 'ws')::uuid, 'Lina S.', 'lina@example.com', 'manual',
          (select id from public.members where user_id = '10000000-0000-0000-0000-000000000005'));
insert into public.contact_identities (workspace_id, contact_id, kind, address) select (select v from ids where k = 'ws')::uuid, id, 'email', 'lina@example.com' from public.contacts where email = 'lina@example.com';
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is(public.import_contacts((select v from ids where k = 'ws')::uuid, '[
  {"name": "Lina Saleh", "email": "Lina@Example.com", "phone": "+971 50 111 2222", "company": "Saleh Trading", "tags": ["VIP"]},
  {"name": "Omar", "email": "omar@example.com", "consent": "yes"},
  {"name": "Nobody"}
]'), '{"created": 1, "updated": 1, "skipped": 1}'::jsonb, 'one new, one matched, one without email or phone skipped');
reset role;
select is((select name from public.contacts where email = 'lina@example.com'), 'Lina S.', 'an existing name is never overwritten');
select is((select phone from public.contacts where email = 'lina@example.com'), '+971501112222', 'a blank phone is filled in');
select is((select source from public.contact_consent cc join public.contacts c on c.id = cc.contact_id where c.email = 'omar@example.com' and cc.channel = 'email'), 'Imported file',
  'consent from the file is recorded as coming from the file');

select * from finish();
rollback;
