-- Tasks: who sees and assigns what, repeating, undo, snooze, notes, and the privacy tools.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira, team scope), omar ...03 support manager (Mall, team scope),
-- priya ...04 ops manager (all scope), hana ...05 agent (Deira, own scope), aisha ...06 viewer.
begin;
select plan(22);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v text) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id::text from public.workspaces where slug = 'qamar')),
                       ('deira', (select id::text from public.teams where name = 'Deira shop')),
                       ('sara', (select m.id::text from public.members m where m.user_id = '10000000-0000-0000-0000-000000000002')),
                       ('omar', (select m.id::text from public.members m where m.user_id = '10000000-0000-0000-0000-000000000003')),
                       ('hana', (select m.id::text from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005'));
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws')::uuid, 'email', 'Support', 'e27', (select v from ids where k = 'deira')::uuid);
select public.ingest_inbound((select id from public.channels where external_id = 'e27'), 'email', 'lina@example.com', 'Lina K', '<l27@x>', 'text', 'Hi', null, '{}', null, now(), '<l27@x>', 'Hello');
select public.ingest_inbound((select id from public.channels where external_id = 'e27'), 'email', 'lina2@example.com', 'Lina K.', '<m27@x>', 'text', 'Hi', null, '{}', null, now(), '<m27@x>', 'Hello again');
insert into ids select 'lina', contact_id::text from public.contact_identities where address = 'lina@example.com';
insert into ids select 'lina2', contact_id::text from public.contact_identities where address = 'lina2@example.com';

-- Creating and assigning
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('weekly', public.create_task((select v::uuid from ids where k = 'ws'), 'Call back about the sofa', null, null, null, now() + interval '1 day', true, 'weekly')::text);
select is((select count(*)::int from public.tasks), 1, 'an agent creates a task for herself');
select throws_ok($$ select public.create_task((select v::uuid from ids where k = 'ws'), 'For Sara', (select v::uuid from ids where k = 'sara')) $$, '42501', null, 'but cannot hand one to someone else');
select throws_ok($$ select public.create_task((select v::uuid from ids where k = 'ws'), 'Needs a date', null, null, null, null, false, 'daily') $$, '22023', null, 'a repeating task needs a date');
reset role;

select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
insert into ids values ('plain', public.create_task((select v::uuid from ids where k = 'ws'), 'Send the quote', (select v::uuid from ids where k = 'hana'))::text);
select is((select count(*)::int from public.tasks), 2, 'a team manager can give a task to someone in their team');
select throws_ok($$ select public.create_task((select v::uuid from ids where k = 'ws'), 'Mall job', (select v::uuid from ids where k = 'omar')) $$, '42501', null, 'but not to someone outside it');
reset role;

-- Who sees them
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.tasks), 0, 'a viewer sees no tasks');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.tasks), 0, 'a manager of another team does not see them');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000004');
select is((select count(*)::int from public.tasks), 2, 'someone who manages all tasks sees both');
reset role;

-- Finishing a repeating task makes the next one a week later, and undo takes it back
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('next', public.complete_task((select v::uuid from ids where k = 'weekly'))::text);
select isnt((select v from ids where k = 'next'), null, 'finishing a repeating task returns the next one');
select is((select n.due_at - o.due_at from public.tasks n, public.tasks o where n.id = (select v::uuid from ids where k = 'next') and o.id = (select v::uuid from ids where k = 'weekly')), interval '7 days', 'a week after the first');
select is((select count(*)::int from public.tasks where done_at is null), 2, 'two tasks are open: the other one and the next');
select lives_ok($$ select public.undo_complete_task((select v::uuid from ids where k = 'weekly')) $$, 'undo');
select is((select count(*)::int from public.tasks), 2, 'removes the repeat and reopens the first');
select is((select public.complete_task((select v::uuid from ids where k = 'plain'))), null, 'finishing a one-off task makes nothing');

-- A daily task finished late does not come back already overdue
insert into ids values ('late', public.create_task((select v::uuid from ids where k = 'ws'), 'Stock check', null, null, null, now() - interval '10 days', false, 'daily')::text);
insert into ids values ('latenext', public.complete_task((select v::uuid from ids where k = 'late'))::text);
select ok((select due_at > now() from public.tasks where id = (select v::uuid from ids where k = 'latenext')), 'a task finished days late comes back in the future');

-- Snooze and notes
select lives_ok($$ select public.snooze_task((select v::uuid from ids where k = 'weekly'), now() + interval '3 days', false) $$, 'the owner snoozes a task');
select is((select has_time from public.tasks where id = (select v::uuid from ids where k = 'weekly')), false, 'to a day without a time');
select lives_ok($$ select public.add_task_note((select v::uuid from ids where k = 'weekly'), 'Customer prefers mornings') $$, 'the owner adds a note');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.task_notes), 1, 'her manager can read it');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.add_task_note((select v::uuid from ids where k = 'weekly'), 'Not mine') $$, '42501', null, 'someone outside the team cannot add one');
reset role;

-- Customers: merging keeps the tasks, erasing deletes them
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.create_task((select v::uuid from ids where k = 'ws'), 'Ask about the table', null, (select v::uuid from ids where k = 'lina2'));
select public.merge_contacts((select v::uuid from ids where k = 'lina'), (select v::uuid from ids where k = 'lina2'));
select is((select count(*)::int from public.tasks where contact_id = (select v::uuid from ids where k = 'lina')), 1, 'merging customers moves their tasks');
select public.erase_contacts(array[(select v::uuid from ids where k = 'lina')]);
select is((select count(*)::int from public.tasks where contact_id = (select v::uuid from ids where k = 'lina')), 0, 'erasing a customer deletes their tasks');
reset role;

select * from finish();
rollback;
