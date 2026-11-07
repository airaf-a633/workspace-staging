-- Notifications: who is told what, who is not, read state, the late-task sweep, and erasing a customer.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall), hana ...05 agent (Deira),
-- aisha ...06 viewer (Mall), noor ...07 another business.
begin;
select plan(29);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.notices(p_user uuid, p_kind text) returns int language sql as $$
  select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = p_user and n.kind = p_kind
$$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values
  ('ws', (select id from public.workspaces where slug = 'qamar')),
  ('deira', (select id from public.teams where name = 'Deira shop')),
  ('hana', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005')),
  ('sara', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000002')),
  ('khalid', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000001'));

insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws'), 'email', 'Support', 'e28', (select v from ids where k = 'deira'));
select public.ingest_inbound((select id from public.channels where external_id = 'e28'), 'email', 'lina@example.com', 'Lina Haddad', '<a28@x>', 'text', 'Hi', null, '{}', null, now(), '<a28@x>', 'Sofa');
insert into ids select 'lina', contact_id from public.contact_identities where address = 'lina@example.com';
insert into ids select 'conv', id from public.conversations where channel_id = (select id from public.channels where external_id = 'e28');

-- A handover tells the person it was handed to, and nobody else
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select public.hand_over_conversation((select v from ids where k = 'conv'), (select v from ids where k = 'hana'), null, 'Customer wants the grey sofa');
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'handover'), 1, 'handing a chat to Hana tells Hana');
select is((select quote from public.notifications where kind = 'handover'), 'Customer wants the grey sofa', 'with the handoff note');
select is(pg_temp.notices('10000000-0000-0000-0000-000000000002', 'handover'), 0, 'and does not tell the person who did it');

-- Mentions reach people who may see the chat, never the writer
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select public.add_conversation_note((select v from ids where k = 'conv'), 'Check stock @Hana and @Aisha',
  array[(select v from ids where k = 'hana'), (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000006')]);
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'mention'), 1, 'an @mention tells Hana');
select is(pg_temp.notices('10000000-0000-0000-0000-000000000006', 'mention'), 0, 'but not Aisha, who cannot see this chat');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select public.add_conversation_note((select v from ids where k = 'conv'), 'Thanks @Sara and @me',
  array[(select v from ids where k = 'sara'), (select v from ids where k = 'hana')]);
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000002', 'mention'), 1, 'Sara hears when Hana mentions her');
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'mention'), 1, 'mentioning yourself tells nobody');

-- Asking to collaborate tells whoever holds the chat
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.ask_to_collaborate((select v from ids where k = 'conv'));
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'collab_request'), 1, 'asking to collaborate tells the holder');

-- Everyone reads only their own
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.notifications), 3, 'Hana sees her three');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select is((select count(*)::int from public.notifications where member_id = (select v from ids where k = 'hana')), 0, 'the owner cannot read hers');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.notifications), 0, 'another business sees none');
reset role;

-- Read state belongs to each person
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is(public.mark_notifications_read((select v from ids where k = 'ws'), array[(select id from public.notifications where kind = 'handover')]), 1, 'Hana marks one read');
select is(public.mark_notifications_read((select v from ids where k = 'ws')), 2, 'then the rest');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select is(public.mark_notifications_read((select v from ids where k = 'ws')), 0, 'marking all as the owner touches only the owner''s');
reset role;
select is((select count(*)::int from public.notifications where member_id = (select v from ids where k = 'hana') and read_at is null), 0, 'and Hana''s stay marked');

-- Discounts: approvers hear the ask, the asker hears the answer
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('deal', public.create_deal((select v from ids where k = 'ws'), 'Sofa set', (select v from ids where k = 'lina'), 100000));
insert into ids values ('approval', public.request_discount((select v from ids where k = 'deal'), 10, 'Loyal customer'));
reset role;
select is((select count(*)::int from public.notifications where kind = 'discount_asked' and member_id in ((select v from ids where k = 'khalid'), (select v from ids where k = 'sara'))), 2, 'the owner and the sales manager are asked to approve');
select is((select count(*)::int from public.notifications where kind = 'discount_asked' and member_id not in ((select v from ids where k = 'khalid'), (select v from ids where k = 'sara'))), 0, 'nobody else is, including the one asking');
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select public.decide_discount((select v from ids where k = 'approval'), true, 'Fine');
reset role;
select is((select percent from public.notifications where kind = 'discount_approved' and member_id = (select v from ids where k = 'hana')), 10.00, 'the answer, with the percent, reaches Hana');
select is((select count(*)::int from public.notifications where kind = 'discount_asked' and read_at is null), 0, 'and the question stops waiting on the other approver');

-- Tasks: handed to you by someone else, not made by you
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select public.create_task((select v from ids where k = 'ws'), 'Send the quote', (select v from ids where k = 'hana'));
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'task_assigned'), 1, 'a task from Sara tells Hana');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('late', public.create_task((select v from ids where k = 'ws'), 'Stock check', null, null, null, now() - interval '2 days', true));
reset role;
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'task_assigned'), 1, 'a task Hana makes for herself tells nobody');

-- The sweep: late once per due time, and finishing the task reads it
select ok(public.sweep_notifications() >= 1, 'the sweep notices the late task');
select is(pg_temp.notices('10000000-0000-0000-0000-000000000005', 'task_late'), 1, 'Hana hears her task is late');
select is(public.sweep_notifications(), 0, 'and it does not tell her twice');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select public.complete_task((select v from ids where k = 'late'));
reset role;
select is((select count(*)::int from public.notifications where kind = 'task_late' and read_at is null), 0, 'finishing the task reads the notice');
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.sweep_notifications() $$, '42501', null, 'signed-in people cannot run the sweep');
reset role;

-- A channel that stops working tells those who manage numbers
update public.channels set status = 'disconnected' where external_id = 'e28';
select is(pg_temp.notices('10000000-0000-0000-0000-000000000001', 'channel_broken'), 1, 'the owner hears a channel disconnected');
select is(pg_temp.notices('10000000-0000-0000-0000-000000000002', 'channel_broken'), 0, 'the sales manager does not');

-- Erasing the customer removes every notice that names them
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.erase_contacts(array[(select v from ids where k = 'lina')]);
reset role;
select is((select count(*)::int from public.notifications where contact_id = (select v from ids where k = 'lina')), 0, 'erasing the customer removes notices that name or quote them');

select * from finish();
rollback;
