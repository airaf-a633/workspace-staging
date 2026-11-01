-- The other channels, step 0: credentials, connecting, webhook lookup and reply windows.
-- Seed: khalid ...01 owner, hana ...05 agent, noor ...07 owner of another business.
begin;
select plan(19);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

-- Connecting
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ insert into ids select 'tg', public.connect_channel((select v from ids where k = 'ws')::uuid, 'telegram', 'Support bot', '555', '{"username":"qamar_bot"}', '{"bot_token":"123:abc","secret":"s3cret"}')::text $$, 'the owner connects a Telegram bot');
select is(length((select v::jsonb ->> 'key' from ids where k = 'tg')), 32, 'the channel gets a 32-character webhook key');
select throws_ok($$ select public.connect_channel((select v from ids where k = 'ws')::uuid, 'telegram', 'Again', '555', '{}', '{}') $$, '23505', 'already_connected', 'the same bot cannot be connected twice');
select throws_ok($$ select public.connect_channel((select v from ids where k = 'ws')::uuid, 'whatsapp', 'No', '1', '{}', '{}') $$, '22023', 'bad_type', 'WhatsApp has its own flow');
select throws_ok($$ select public.connect_channel((select v from ids where k = 'ws')::uuid, 'telegram', '  ', '556', '{}', '{}') $$, '22023', 'need_name', 'a name is required');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.connect_channel((select v from ids where k = 'ws')::uuid, 'telegram', 'Mine', '557', '{}', '{}') $$, '42501', null, 'an agent cannot connect a channel');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select throws_ok($$ select public.connect_channel((select v from ids where k = 'ws')::uuid, 'telegram', 'Theirs', '558', '{}', '{}') $$, '42501', null, 'another business cannot connect into this workspace');
reset role;

-- Credentials stay in Vault
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select count(*) from public.channel_credentials $$, '42501', null, 'nobody signed in can read the credentials table');
select throws_ok($$ select public.channel_secrets((select (v::jsonb ->> 'id')::uuid from ids where k = 'tg')) $$, '42501', null, 'nobody signed in can read the decrypted secrets');
reset role;

select is((select secrets ->> 'bot_token' from public.channel_for_webhook('telegram', (select v::jsonb ->> 'key' from ids where k = 'tg'))), '123:abc', 'the server finds the channel by its webhook key, with its secret');
select is((select count(*)::int from public.channel_for_webhook('telegram', repeat('0', 32))), 0, 'a wrong key finds nothing');
select is((select settings ->> 'username' from public.channels where id = (select (v::jsonb ->> 'id')::uuid from ids where k = 'tg')), 'qamar_bot', 'settings are kept, and hold no secret');

-- Replacing a credential
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.update_channel_credentials((select (v::jsonb ->> 'id')::uuid from ids where k = 'tg'), '{}', '{"bot_token":"999:new"}') $$, 'the owner replaces the token');
reset role;
select is((select secrets ->> 'bot_token' from public.channel_for_webhook('telegram', (select v::jsonb ->> 'key' from ids where k = 'tg'))), '999:new', 'the new token is the one in use');

-- Renaming and disconnecting
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.update_channel_credentials((select (v::jsonb ->> 'id')::uuid from ids where k = 'tg'), '{"webhook_key":"evil"}', '{}', 'Renamed bot') $$, 'the owner renames a channel');
reset role;
select is((select name from public.channels where id = (select (v::jsonb ->> 'id')::uuid from ids where k = 'tg')), 'Renamed bot', 'the new name is saved');
select is((select settings ->> 'webhook_key' from public.channels where id = (select (v::jsonb ->> 'id')::uuid from ids where k = 'tg')), (select v::jsonb ->> 'key' from ids where k = 'tg'), 'a settings update cannot change the webhook key');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.disconnect_channel((select (v::jsonb ->> 'id')::uuid from ids where k = 'tg')) $$, '42501', null, 'an agent cannot disconnect a channel');
reset role;

-- Reply windows: TikTok allows 48 hours
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids select 'tt', public.connect_channel((select v from ids where k = 'ws')::uuid, 'tiktok', 'TikTok', 'tt1', '{}', '{}')::text;
reset role;
update public.channels set team_id = (select id from public.teams where name = 'Deira shop') where id = (select (v::jsonb ->> 'id')::uuid from ids where k = 'tt');
select public.ingest_inbound((select (v::jsonb ->> 'id')::uuid from ids where k = 'tt'), 'tiktok', 'u1', 'Ana', 'tt:1', 'text', 'Hi', null, '{}', null, now() - interval '3 days');
insert into ids select 'conv', id::text from public.conversations where channel_id = (select (v::jsonb ->> 'id')::uuid from ids where k = 'tt');
update public.conversations set holder_member_id = (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005' and m.workspace_id = (select v::uuid from ids where k = 'ws')) where id = (select v::uuid from ids where k = 'conv');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.send_reply((select v from ids where k = 'conv')::uuid, 'Hello?', 'c-18-1') $$, 'P0001', 'window_closed', 'TikTok: no reply after 48 hours');
reset role;

select * from finish();
rollback;
