-- SMS: per-channel text length, and STOP / START.
-- Seed: khalid ...01 owner, hana ...05 agent.
begin;
select plan(12);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar')),
                       ('deira', (select id::text from public.teams where name = 'Deira shop'));
insert into public.channels (workspace_id, type, name, external_id, team_id, settings)
values ((select v from ids where k = 'ws')::uuid, 'sms', 'Texts', '+15550100', (select v from ids where k = 'deira')::uuid, '{}');
insert into ids select 'ch', id::text from public.channels where external_id = '+15550100';
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'phone', '15551234567', null, 'SM001', 'text', 'Hi', null, '{}', null, now());
insert into ids select 'conv', id::text from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid;
insert into ids select 'contact', contact_id::text from public.conversations where id = (select v from ids where k = 'conv')::uuid;
update public.conversations set holder_member_id = (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005' and m.workspace_id = (select v::uuid from ids where k = 'ws')) where id = (select v::uuid from ids where k = 'conv');

-- Text length per channel
select is(public.channel_max_length('sms'), 1600, 'SMS takes 1,600 characters');
select is(public.channel_max_length('line'), 5000, 'LINE takes 5,000');
select is(public.channel_max_length('telegram'), 4096, 'the rest keep 4,096');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.send_reply((select v from ids where k = 'conv')::uuid, repeat('a', 1600), 'c-20-0001') $$, 'a 1,600-character text is accepted');
select throws_ok($$ select public.send_reply((select v from ids where k = 'conv')::uuid, repeat('a', 1601), 'c-20-0002') $$, '22023', 'too_long', 'a 1,601-character text is refused');
reset role;

-- STOP
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_opted_out', 'phone', '15551234567');
select is((select status from public.contact_consent where contact_id = (select v from ids where k = 'contact')::uuid and channel = 'sms'), 'out', 'STOP marks them opted out of SMS marketing');
select is((select source from public.contact_consent where contact_id = (select v from ids where k = 'contact')::uuid and channel = 'sms'), 'Customer replied STOP', 'and says why');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_opted_out'), 1, 'and writes a line in the chat');
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_opted_out', 'phone', '15551234567');
select is((select count(*)::int from public.conversation_events where conversation_id = (select v from ids where k = 'conv')::uuid and kind = 'customer_opted_out'), 1, 'a repeated STOP adds no second line');

-- START lifts only their own STOP
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_opted_in', 'phone', '15551234567');
select is((select count(*)::int from public.contact_consent where contact_id = (select v from ids where k = 'contact')::uuid and channel = 'sms'), 0, 'START lifts the opt-out that STOP made');
insert into public.contact_consent (workspace_id, contact_id, channel, status, source) values ((select v from ids where k = 'ws')::uuid, (select v from ids where k = 'contact')::uuid, 'sms', 'out', 'Changed by the team');
select public.record_channel_event((select v from ids where k = 'ch')::uuid, 'customer_opted_in', 'phone', '15551234567');
select is((select status from public.contact_consent where contact_id = (select v from ids where k = 'contact')::uuid and channel = 'sms'), 'out', 'START never undoes an opt-out that came from the team');

select ok(exists (select 1 from public.audit_log where action = 'consent' and entity_id = (select v from ids where k = 'contact') and data ->> 'source' = 'Customer replied STOP'), 'the opt-out is in the audit log');

select * from finish();
rollback;
