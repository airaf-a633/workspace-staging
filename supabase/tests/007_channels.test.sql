-- Omnichannel foundation: channels, contact identities, email threading.
-- Seed: khalid ...01 owner, sara ...02 sales (Deira), omar ...03 support (Mall), noor ...07 another business.
begin;
select plan(11);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id from public.workspaces where slug = 'qamar'));

-- Connecting WhatsApp creates a channel with the same id
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('wa', public.connect_whatsapp_account((select v from ids where k = 'ws'), '1111111111', '3333333333', '+971 4 555 0191', 'Qamar', 'GREEN', 'x'||repeat('t', 40), true));
select is((select type from public.channels where id = (select v from ids where k = 'wa')), 'whatsapp', 'a WhatsApp number is a channel');
select throws_ok($$ insert into public.channels (workspace_id, type, name) values ((select v from ids where k = 'ws'), 'email', 'Support') $$,
  '42501', null, 'app users cannot create channels directly');

-- An email channel (as the worker)
reset role;
insert into public.channels (workspace_id, type, name, external_id) values ((select v from ids where k = 'ws'), 'email', 'Support', 'support@qamar.example');
insert into ids select 'mail', id from public.channels where external_id = 'support@qamar.example';

-- One person on two channels stays two identities until linked; each identity finds its contact again
select isnt(public.ingest_inbound((select v from ids where k = 'wa'), 'whatsapp', '971501112222', 'Mariam', 'wamid.C1', 'text', 'Hi', null, '{}', null, now()), null, 'WhatsApp message stored');
select isnt(public.ingest_inbound((select v from ids where k = 'wa'), 'whatsapp', '971501112222', 'Mariam', 'wamid.C2', 'text', 'Again', null, '{}', null, now()), null, 'second WhatsApp message stored');
select is((select count(*)::int from public.contact_identities where address = '971501112222'), 1, 'one identity per address');
select is((select count(*)::int from public.conversations where channel_id = (select v from ids where k = 'wa')), 1, 'chat channels keep one thread per customer');
select is((select phone from public.contacts c join public.contact_identities i on i.contact_id = c.id where i.address = '971501112222'), '+971501112222', 'a WhatsApp sender gets a phone number');

-- Email threads by thread key
select isnt(public.ingest_inbound((select v from ids where k = 'mail'), 'email', 'mariam@example.com', 'Mariam', '<a@example.com>', 'text', 'Order?', null, '{}', null, now(), '<a@example.com>', 'Where is my order'), null, 'email stored');
select isnt(public.ingest_inbound((select v from ids where k = 'mail'), 'email', 'mariam@example.com', 'Mariam', '<b@example.com>', 'text', 'Refund', null, '{}', null, now(), '<b@example.com>', 'Refund please'), null, 'second email stored');
select is((select count(*)::int from public.conversations where channel_id = (select v from ids where k = 'mail')), 2, 'two email threads from the same sender stay separate');

-- Another business sees no channels or identities
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.channels where workspace_id = (select v from ids where k = 'ws')) + (select count(*)::int from public.contact_identities where address = 'mariam@example.com'), 0,
  'another business sees none of it');

select * from finish();
rollback;
