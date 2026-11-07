-- Step 2c: exporting customer data.
-- Seed: khalid ...01 owner, hana ...05 agent, aisha ...06 viewer, noor ...07 another business.
begin;
select plan(7);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar')),
                       ('deira', (select id::text from public.teams where name = 'Deira shop'));
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws')::uuid, 'email', 'Support', 'e17', (select v from ids where k = 'deira')::uuid);
select public.ingest_inbound((select id from public.channels where external_id = 'e17'), 'email', 'rana@example.com', 'Rana Aziz', '<r17@x>', 'text', 'Where is my parcel?', null, '{}', null, now(), '<r17@x>', 'Parcel');
insert into ids select 'rana', contact_id::text from public.contact_identities where address = 'rana@example.com';
update public.contacts set tags = '{VIP}' where id = (select v from ids where k = 'rana')::uuid;

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select is((select jsonb_array_length(public.export_contacts(array[(select v from ids where k = 'rana')::uuid]))), 1, 'the owner exports a customer');
select is((select public.export_contacts(array[(select v from ids where k = 'rana')::uuid]) -> 0 -> 'conversations' -> 0 -> 'messages' -> 0 ->> 'text'), 'Where is my parcel?', 'the export includes the messages');
select is((select public.export_contacts(array[(select v from ids where k = 'rana')::uuid]) -> 0 -> 'tags' ->> 0), 'VIP', 'the export includes tags');
select is((select count(*)::int from public.audit_log where action = 'export'), 3, 'each export is written to the audit log');
select is((select jsonb_array_length(public.export_contacts('{}'))), 0, 'nothing selected gives an empty export');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.export_contacts(array[(select v from ids where k = 'rana')::uuid]) $$, '42501', null, 'an agent cannot export');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select throws_ok($$ select public.export_contacts(array[(select v from ids where k = 'rana')::uuid]) $$, '42501', null, 'another business cannot export it');
reset role;

select * from finish();
rollback;
