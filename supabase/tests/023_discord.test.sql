-- Discord: the gateway's view of connected bots, its health report, and the 2,000-character limit.
-- Seed: khalid ...01 owner.
begin;
select plan(8);

create temp table ids (k text primary key, v text) on commit drop;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));
insert into public.channels (workspace_id, type, name, external_id, settings)
values ((select v from ids where k = 'ws')::uuid, 'discord', 'Support bot', 'BOT1', '{"webhook_key":"abc"}'),
       ((select v from ids where k = 'ws')::uuid, 'discord', 'Old bot', 'BOT2', '{}');
insert into ids select 'on', id::text from public.channels where external_id = 'BOT1';
insert into ids select 'off', id::text from public.channels where external_id = 'BOT2';
update public.channels set status = 'disconnected' where id = (select v::uuid from ids where k = 'off');

select is(public.channel_max_length('discord'), 2000, 'Discord takes 2,000 characters');
select is(public.channel_max_length('slack'), 4000, 'Slack still takes 4,000');
select is(public.channel_max_length('telegram'), 4096, 'the rest keep 4,096');

select is((select count(*)::int from public.discord_gateway_channels() where id in ((select v::uuid from ids where k = 'on'), (select v::uuid from ids where k = 'off'))), 1, 'only connected bots are kept online');

select public.update_channel_runtime((select v::uuid from ids where k = 'on'), 'ok', 'Connected', '{"bot_user_id":"123","application_id":"456","webhook_key":"hijack"}');
select is((select health ->> 'state' from public.channels where id = (select v::uuid from ids where k = 'on')), 'ok', 'the connection state is recorded');
select is((select settings ->> 'application_id' from public.channels where id = (select v::uuid from ids where k = 'on')), '456', 'and what Discord said about the bot is merged into the settings');
select is((select settings ->> 'webhook_key' from public.channels where id = (select v::uuid from ids where k = 'on')), 'abc', 'but the webhook key cannot be changed');

set local role authenticated;
select throws_ok($$ select public.update_channel_runtime(gen_random_uuid(), 'ok', '', '{}') $$, '42501', null, 'a signed-in person cannot call the gateway functions');
reset role;

select * from finish();
rollback;
