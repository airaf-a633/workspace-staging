-- Slack: finding the workspace, filing staff messages in the right chat, and the 4,000-character limit.
-- Seed: khalid ...01 owner.
begin;
select plan(10);

create temp table ids (k text primary key, v text) on commit drop;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));
insert into public.channels (workspace_id, type, name, external_id, settings)
values ((select v from ids where k = 'ws')::uuid, 'slack', 'Acme Slack', 'T0123ABCD', '{"team_id":"T0123ABCD"}');
insert into ids select 'ch', id::text from public.channels where external_id = 'T0123ABCD';

select is(public.channel_max_length('slack'), 4000, 'Slack takes 4,000 characters');
select is((select count(*)::int from public.slack_channel_for_team('T0123ABCD')), 1, 'a Slack workspace finds its channel by team id');
select is((select count(*)::int from public.slack_channel_for_team('T9999')), 0, 'an unknown workspace finds nothing');

-- Two outside people in one Slack channel C1, one in C2
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'slack', 'U_ANA', 'Ana', 'C1:100.1', 'text', 'Hello', null, '{}', null, now(), 'C1');
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'slack', 'U_BEN', 'Ben', 'C1:101.1', 'text', 'Hi', null, '{}', null, now(), 'C1');
select public.ingest_inbound((select v from ids where k = 'ch')::uuid, 'slack', 'U_CAL', 'Cal', 'C2:200.1', 'text', 'Hey', null, '{}', null, now(), 'C2');
select is((select count(*)::int from public.conversations where channel_id = (select v from ids where k = 'ch')::uuid), 3, 'each person in each Slack channel has their own chat');

-- Staff reply inside Ana's thread goes to Ana's chat
select ok(public.ingest_team_message((select v from ids where k = 'ch')::uuid, 'C1:100.2', 'C1', 'C1:100.1', 'text', 'On it', '{}', now()) is not null, 'a staff reply in a thread is filed');
select is((select c.contact_id = (select contact_id from public.contact_identities where kind = 'slack' and address = 'U_ANA') from public.messages m join public.conversations c on c.id = m.conversation_id where m.external_id = 'C1:100.2'), true, 'in the chat of the person it answered');
select is((select source || '/' || direction from public.messages where external_id = 'C1:100.2'), 'channel_app/out', 'as the team, marked as sent outside Relay');

-- Not in a thread: two people in C1, so it is unclear who it is for; C2 has one, so it is clear
select ok(public.ingest_team_message((select v from ids where k = 'ch')::uuid, 'C1:102.1', 'C1', null, 'text', 'Anyone there?', '{}', now()) is null, 'a loose staff message among two people is not guessed');
select ok(public.ingest_team_message((select v from ids where k = 'ch')::uuid, 'C2:201.1', 'C2', null, 'text', 'Welcome', '{}', now()) is not null, 'but is filed when the channel has one person');

-- Removing the app disconnects, keeping history
select public.slack_app_removed('T0123ABCD');
select is((select status from public.channels where external_id = 'T0123ABCD'), 'disconnected', 'removing the app disconnects the channel');

select * from finish();
rollback;
