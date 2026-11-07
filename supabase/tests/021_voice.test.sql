-- Voice: calls and voicemails are filed once each, and a phone number can't be replied to in text.
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
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar')),
                       ('deira', (select id::text from public.teams where name = 'Deira shop'));
insert into public.channels (workspace_id, type, name, external_id, team_id, settings)
values ((select v from ids where k = 'ws')::uuid, 'voice', 'Shop line', '+15550199', (select v from ids where k = 'deira')::uuid, '{}');
insert into ids select 'ch', id::text from public.channels where external_id = '+15550199';

-- A missed call, then the voicemail that came with it
select ok(public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'phone', '15551234567', null, 'CA001', 'call', null, null, '{"call":{"direction":"in","missed":true}}', null, now()) is not null, 'a call is filed');
select ok(public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'phone', '15551234567', null, 'vm-RE001', 'audio', null, null, '{"call":{"direction":"in","voicemail":true,"duration":14}}', null, now()) is not null, 'and so is its voicemail');
select ok(public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'phone', '15551234567', null, 'CA001', 'call', null, null, '{}', null, now()) is null, 'Twilio sending the same call again files nothing new');

insert into ids select 'conv', id::text from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid;
select is((select count(*)::int from public.messages where conversation_id = (select v from ids where k = 'conv')::uuid), 2, 'one conversation holds the call and the voicemail');
select is((select data -> 'call' ->> 'missed' from public.messages where external_id = 'CA001'), 'true', 'the call keeps what the screen needs');
select is((select identity.kind from (select i.kind from public.contact_identities i join public.conversations c on c.contact_id = i.contact_id where c.id = (select v::uuid from ids where k = 'conv')) identity), 'phone', 'the caller is known by their phone number');

-- No text replies
update public.conversations set holder_member_id = (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005' and m.workspace_id = (select v::uuid from ids where k = 'ws')) where id = (select v::uuid from ids where k = 'conv');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.send_reply((select v from ids where k = 'conv')::uuid, 'Hello', 'c-21-0001') $$, 'P0001', 'cannot_reply', 'a text to a phone number is refused');
reset role;

select * from finish();
rollback;
