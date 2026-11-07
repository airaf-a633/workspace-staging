-- Gated channels: "Request access" is saved once per channel, and renewing a stored token keeps the others.
-- Seed: khalid ...01 owner, hana ...05 agent.
begin;
select plan(8);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.request_channel_access((select v::uuid from ids where k = 'ws'), 'tiktok', 'We sell to Gulf customers on TikTok') $$, 'an owner can request access');
select is((select count(*)::int from public.channel_access_requests where channel = 'tiktok'), 1, 'it is saved');
select is((select note from public.channel_access_requests where channel = 'tiktok'), 'We sell to Gulf customers on TikTok', 'with the note');
select lives_ok($$ select public.request_channel_access((select v::uuid from ids where k = 'ws'), 'tiktok', 'Changed my mind about the note') $$, 'asking again is fine');
select is((select count(*)::int || ':' || max(note) from public.channel_access_requests where channel = 'tiktok'), '1:Changed my mind about the note', 'it only changes the note');
select throws_ok($$ select public.request_channel_access((select v::uuid from ids where k = 'ws'), 'telegram', null) $$, '22023', 'bad_channel', 'only the gated channels can be requested');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.request_channel_access((select v::uuid from ids where k = 'ws'), 'apple', null) $$, '42501', 'not_allowed', 'an agent cannot request access');
reset role;

-- A renewed token replaces itself and leaves the other credentials alone
insert into public.channels (workspace_id, type, name, external_id, settings)
values ((select v::uuid from ids where k = 'ws'), 'x', 'X', 'xapp1', '{}');
insert into ids select 'ch', id::text from public.channels where external_id = 'xapp1';
select public.store_channel_secrets((select v::uuid from ids where k = 'ch'), '{"client_secret":"s1","access_token":"a1"}');
select public.store_channel_secrets((select v::uuid from ids where k = 'ch'), '{"access_token":"a2","refresh_token":"r2"}');
select is((select public.channel_secrets((select v::uuid from ids where k = 'ch')) ->> 'access_token' || '/' || (public.channel_secrets((select v::uuid from ids where k = 'ch')) ->> 'client_secret') || '/' || (public.channel_secrets((select v::uuid from ids where k = 'ch')) ->> 'refresh_token')), 'a2/s1/r2', 'the new token replaces the old and the other credentials stay');

select * from finish();
rollback;
