-- M2.4 step 1: sending text replies. Who may send, the channel rules, no double sends, and the worker's side.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall),
-- hana ...05 agent (Deira), aisha ...06 viewer (Mall).
begin;
select plan(15);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id from public.workspaces where slug = 'qamar')),
  ('deira', (select id from public.teams where name = 'Deira shop')),
  ('hana', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005'));

-- A WhatsApp chat in Deira, written 10 minutes ago, held by Hana
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws'), 'whatsapp', 'Shop WhatsApp', '5555555555', (select v from ids where k = 'deira'));
insert into ids select 'ch', id from public.channels where external_id = '5555555555';
insert into public.whatsapp_accounts (id, workspace_id, waba_id, phone_number_id, display_phone)
values ((select v from ids where k = 'ch'), (select v from ids where k = 'ws'), '4444444444', '5555555555', '+971 4 555 0199');
select public.ingest_inbound((select v from ids where k = 'ch'), 'whatsapp', '971509998888', 'Yusuf', 'wamid.S1', 'text', 'Price?', null, '{}', null, now() - interval '10 minutes');
insert into ids select 'c', id from public.conversations where channel_id = (select v from ids where k = 'ch');
update public.conversations set holder_member_id = (select v from ids where k = 'hana') where id = (select v from ids where k = 'c');

-- Who may send
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ insert into ids values ('m1', public.send_reply((select v from ids where k = 'c'), '  It''s 120 dirhams.  ', 'client-0001')) $$, 'Hana (holder) sends a reply');
select is((select status from public.messages where id = (select v from ids where k = 'm1')), 'queued', 'the reply waits in the queue');
select is((select body from public.messages where id = (select v from ids where k = 'm1')), 'It''s 120 dirhams.', 'spaces around the text are trimmed');
select is(public.send_reply((select v from ids where k = 'c'), 'It''s 120 dirhams.', 'client-0001'), (select v from ids where k = 'm1'), 'the same click again returns the same message');
select throws_ok($$ select public.send_reply((select v from ids where k = 'c'), '   ', 'client-0002') $$, '22023', 'empty', 'an empty reply is refused');
reset role;
select is((select count(*)::int from public.jobs where queue = 'send_message' and payload ->> 'message_id' = (select v from ids where k = 'm1')::text), 1, 'exactly one send job');

select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.send_reply((select v from ids where k = 'c'), 'Manager here, happy to help.', 'client-0003') $$, 'Sara (manager, override) can reply without taking over');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select throws_ok($$ select public.send_reply((select v from ids where k = 'c'), 'hi', 'client-0004') $$, 'P0002', null, 'Aisha (viewer, Mall) cannot even see it');

-- Channel rules
reset role;
update public.conversations set last_customer_message_at = now() - interval '25 hours' where id = (select v from ids where k = 'c');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.send_reply((select v from ids where k = 'c'), 'Still there?', 'client-0005') $$, 'P0001', 'window_closed', 'WhatsApp: no free-form reply after 24 hours');
reset role;
update public.conversations set last_customer_message_at = now() where id = (select v from ids where k = 'c');
update public.channels set status = 'disconnected' where id = (select v from ids where k = 'ch');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.send_reply((select v from ids where k = 'c'), 'Hello?', 'client-0006') $$, 'P0001', 'channel_disconnected', 'nothing sends on a disconnected channel');
select throws_ok($$ select public.outbound_message((select v from ids where k = 'm1')) $$, '42501', null, 'app users cannot read the worker''s view');

-- The worker's side
reset role;
select is((select to_address from public.outbound_message((select v from ids where k = 'm1'))), '971509998888', 'the worker finds the customer''s WhatsApp number');
select public.mark_message_sent((select v from ids where k = 'm1'), 'wamid.OUT1');
select is((select status from public.messages where id = (select v from ids where k = 'm1')), 'sent', 'sent after WhatsApp accepts it');
select public.mark_message_failed((select v from ids where k = 'm1'), '131047', 'late');
select is((select status from public.messages where id = (select v from ids where k = 'm1')), 'sent', 'a late failure never overwrites a sent message');
select public.apply_message_status((select v from ids where k = 'ch'), 'wamid.OUT1', 'delivered');
select is((select status from public.messages where id = (select v from ids where k = 'm1')), 'delivered', 'delivery ticks arrive as before');

select * from finish();
rollback;
