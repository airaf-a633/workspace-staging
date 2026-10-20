-- Customers and companies on real data, custom fields, labels and helpers.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall), hana ...05 agent (Deira),
-- aisha ...06 viewer (Mall), noor ...07 another business.
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
  ('deira', (select id::text from public.teams where name = 'Deira shop')),
  ('hana', (select id::text from public.members where user_id = '10000000-0000-0000-0000-000000000005')),
  ('sara', (select id::text from public.members where user_id = '10000000-0000-0000-0000-000000000002')),
  ('aisha', (select id::text from public.members where user_id = '10000000-0000-0000-0000-000000000006'));

-- A Deira chat with Mariam, held by Hana
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws')::uuid, 'webchat', 'Site', 'k15', (select v from ids where k = 'deira')::uuid);
select public.ingest_inbound((select id from public.channels where external_id = 'k15'), 'webchat', repeat('c', 64), 'Mariam', 'wc:15', 'text', 'Hi', null, '{}', null, now());
insert into ids select 'c', contact_id::text from public.conversations where channel_id = (select id from public.channels where external_id = 'k15');
insert into ids select 'conv', id::text from public.conversations where channel_id = (select id from public.channels where external_id = 'k15');
update public.conversations set holder_member_id = (select v from ids where k = 'hana')::uuid where id = (select v from ids where k = 'conv')::uuid;

-- Editing: everyone who can see them, except Viewers
select is((select scope::text from public.role_permissions rp join public.members m on m.role_id = rp.role_id
           where m.id = (select v from ids where k = 'hana')::uuid and rp.permission = 'contacts.edit'), 'all', 'Agents now edit any customer they can see');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid,
  '{"name": "Mariam Haddad", "email": "Mariam@Example.com", "phone": "+44 7700 900412", "lifecycle": "customer", "tags": ["VIP", " VIP ", "Wholesale"]}') $$,
  'Hana (agent) edits a customer in her chat');
reset role;
select is((select name from public.contacts where id = (select v from ids where k = 'c')::uuid), 'Mariam Haddad', 'the name is saved');
select is((select email from public.contacts where id = (select v from ids where k = 'c')::uuid), 'mariam@example.com', 'the email is saved in lower case');
select is((select phone from public.contacts where id = (select v from ids where k = 'c')::uuid), '+447700900412', 'the phone is saved without spaces');
select is((select tags from public.contacts where id = (select v from ids where k = 'c')::uuid), array['VIP', 'Wholesale'], 'tags are trimmed and de-duplicated');
select is((select count(*)::int from public.contact_identities where contact_id = (select v from ids where k = 'c')::uuid and kind in ('email', 'phone')), 2,
  'the new email and phone become ways to reach them');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid, '{"email": "not an email"}') $$, '22023', 'bad_email', 'a malformed email is refused');
select throws_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid, '{"lifecycle": "vip"}') $$, '23514', null, 'an unknown stage is refused');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid, '{"name": "x"}') $$, '42501', 'not_allowed', 'Aisha (viewer) cannot edit');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select throws_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid, '{"name": "x"}') $$, '42501', 'not_allowed', 'another business cannot edit');
reset role;

-- Adding by hand: the owner sees it straight away
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.create_contact((select v from ids where k = 'ws')::uuid, 'Lina', '', '') $$, '22023', 'need_reach', 'a new customer needs an email or phone');
select lives_ok($$ insert into ids values ('lina', public.create_contact((select v from ids where k = 'ws')::uuid, 'Lina', 'lina@example.com', null)::text) $$, 'Hana adds a customer by hand');
select is((select count(*)::int from public.contacts where id = (select v from ids where k = 'lina')::uuid), 1, 'and can see the customer she added, with no chat yet');
reset role;

-- Companies
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ insert into ids values ('co', public.save_company((select v from ids where k = 'ws')::uuid, null, '{"name": "Haddad Interiors", "domain": "https://www.HaddadInteriors.co.uk/about"}')::text) $$,
  'Sara adds a company');
reset role;
select is((select domain from public.companies where id = (select v from ids where k = 'co')::uuid), 'haddadinteriors.co.uk', 'the website is kept as a bare domain');
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.save_company((select v from ids where k = 'ws')::uuid, null, '{"name": "Copy", "domain": "haddadinteriors.co.uk"}') $$, '23505', 'domain_taken', 'one company per domain');
select lives_ok($$ select public.update_contact((select v from ids where k = 'c')::uuid, jsonb_build_object('company', (select v from ids where k = 'co'))) $$, 'Sara links Mariam to it');
reset role;

-- Custom fields
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.save_contact_fields((select v from ids where k = 'ws')::uuid, '[]') $$, '42501', 'not_allowed', 'an agent cannot change the custom fields');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.save_contact_fields((select v from ids where k = 'ws')::uuid, '[{"key": "account_no", "label": "Account number", "type": "text"}, {"key": "size", "label": "Size", "type": "select", "options": ["S", "M"]}]');
select public.update_contact((select v from ids where k = 'c')::uuid, '{"fields": {"account_no": "A-77", "made_up": "x", "size": ""}}');
reset role;
select is((select fields from public.contacts where id = (select v from ids where k = 'c')::uuid), '{"account_no": "A-77"}'::jsonb, 'only defined, non-empty fields are kept');

-- Labels and helpers
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('vip', public.save_label((select v from ids where k = 'ws')::uuid, null, 'VIP', '#B7791F')::text);
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.set_conversation_labels((select v from ids where k = 'conv')::uuid, array[(select v from ids where k = 'vip')::uuid]) $$, 'Hana labels her chat');
select lives_ok($$ select public.set_collaborator((select v from ids where k = 'conv')::uuid, (select v from ids where k = 'sara')::uuid, 'add') $$, 'Hana adds Sara as a helper');
select throws_ok($$ select public.set_collaborator((select v from ids where k = 'conv')::uuid, (select v from ids where k = 'aisha')::uuid, 'add') $$, '22023', 'cannot_reply', 'a Viewer cannot be a helper: they cannot reply');
reset role;
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'collab_added'), 1, 'the trail records the helper');

select * from finish();
rollback;
