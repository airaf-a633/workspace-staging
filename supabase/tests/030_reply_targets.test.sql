-- Reply targets: opening hours and closed days, who may change what, which rule applies, the clock on a chat (first reply,
-- next reply, resolution), what stops and restarts it, who is alerted, and "answered within target" in Reports.
-- Seed: khalid ...01 owner (team General), sara ...02 sales manager (Deira, team scope), omar ...03 support manager (Mall),
-- priya ...04 ops manager (Deira and Mall, team scope), hana ...05 agent (Deira), aisha ...06 viewer (Mall), noor ...07 another business.
begin;
select plan(74);

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
  ('mall', (select id from public.teams where name = 'Dubai Mall shop')),
  ('hana', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005')),
  ('sara', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000002')),
  ('omar', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000003'));

insert into public.channels (workspace_id, type, name, external_id, team_id) values
  ((select v from ids where k = 'ws'), 'email', 'Deira support', 'r-deira', (select v from ids where k = 'deira')),
  ((select v from ids where k = 'ws'), 'email', 'Mall support', 'r-mall', (select v from ids where k = 'mall'));

create function pg_temp.inbound(p_ch text, p_addr text, p_at timestamptz, p_imported boolean default false) returns void language sql as $$
  select public.ingest_inbound((select id from public.channels where external_id = p_ch), 'email', p_addr, p_addr, p_addr || p_at::text, 'text', 'Hi', null, '{}', null, p_at, p_addr, 'Q', p_imported)
$$;
create function pg_temp.outbound(p_addr text, p_member uuid, p_source text, p_at timestamptz, p_status text default 'sent') returns void language sql as $$
  insert into public.messages (workspace_id, conversation_id, external_id, direction, source, type, body, sent_at, sent_by_member, status)
  select c.workspace_id, c.id, 'o-' || p_addr || p_at::text, 'out', p_source, 'text', 'Hello', p_at, p_member, p_status
    from public.conversations c join public.contact_identities i on i.contact_id = c.contact_id where i.address = p_addr
$$;
create function pg_temp.conv(p_addr text) returns uuid language sql as $$
  select c.id from public.conversations c join public.contact_identities i on i.contact_id = c.contact_id where i.address = p_addr
$$;
-- The clock of one kind on one chat, as a text such as "ok 20.00/30" (state, minutes used, limit), or 'none'
create function pg_temp.clock(p_addr text, p_target text) returns text language sql as $$
  select coalesce((select s.state || ' ' || s.used || '/' || s.limit_min || case when s.running then '' else ' paused' end
                     from public.sla_state((select v from ids where k = 'ws'), null) s where s.conversation_id = pg_temp.conv(p_addr) and s.target = p_target), 'none')
$$;
grant execute on function pg_temp.inbound(text, text, timestamptz, boolean), pg_temp.outbound(text, uuid, text, timestamptz, text), pg_temp.conv(text), pg_temp.clock(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Hours and closed days (the Dubai Mall team keeps the starting hours: Monday to Friday, 9 to 17)
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.team_hours where team_id = (select v from ids where k = 'mall')), 5, 'a team starts open Monday to Friday');
insert into public.teams (workspace_id, name) values ((select v from ids where k = 'ws'), 'Brand new');
select is((select count(*)::int from public.team_hours h join public.teams t on t.id = h.team_id where t.name = 'Brand new' and h.opens = 540 and h.closes = 1020), 5, 'and so does a team made later');

-- 6 March 2026 is a Friday, 9 March a Monday; the workspace is on Dubai time (UTC+4)
select is(public.business_minutes((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), '2026-03-06 16:00+04', '2026-03-09 10:00+04'), 120::numeric, 'Friday 16:00 to Monday 10:00 is two hours of opening time: the weekend does not count');
select is(public.business_minutes((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), '2026-03-06 16:00+04', '2026-03-10 10:00+04'), 600::numeric, 'through Tuesday 10:00 it is ten hours');

select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.add_team_closure((select v from ids where k = 'mall'), '2026-03-09', '2026-03-09', null, null, 'Holiday');
reset role;
select is(public.business_minutes((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), '2026-03-06 16:00+04', '2026-03-10 10:00+04'), 120::numeric, 'a closed Monday counts nothing');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.add_team_closure((select v from ids where k = 'mall'), '2026-03-11', '2026-03-11', 600, 720, 'Short day');
reset role;
select is(public.business_minutes((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), '2026-03-11 08:00+04', '2026-03-11 18:00+04'), 120::numeric, 'a day with special hours uses them');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.add_team_closure((select v from ids where k = 'mall'), '2026-03-09', '2026-03-10') $$, 'P0001', 'overlap', 'two closed days for a team cannot overlap');
select throws_ok($$ select public.add_team_closure((select v from ids where k = 'mall'), '2026-03-20', '2026-03-19') $$, '22023', null, 'a closed day cannot end before it starts');
select throws_ok($$ select public.add_team_closure((select v from ids where k = 'mall'), '2026-03-20', '2026-03-20', 900, 600) $$, '22023', null, 'special hours cannot close before they open');
select public.remove_team_closure((select id from public.team_closures where label = 'Holiday'));
reset role;
select is(public.business_minutes((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), '2026-03-06 16:00+04', '2026-03-10 10:00+04'), 600::numeric, 'removing it brings the hours back');

-- Who may change a team's hours
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.save_team_hours((select v from ids where k = 'deira'), '[{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440}]'::jsonb) $$, 'a manager changes the hours of their own team');
select throws_ok($$ select public.save_team_hours((select v from ids where k = 'mall'), '[null,null,null,null,null,null,null]'::jsonb) $$, '42501', null, 'but not another team''s');
select throws_ok($$ select public.add_team_closure((select v from ids where k = 'mall'), '2026-04-01', '2026-04-01') $$, '42501', null, 'nor its closed days');
select throws_ok($$ select public.save_team_hours((select v from ids where k = 'deira'), '[{"opens":600,"closes":600},null,null,null,null,null,null]'::jsonb) $$, '22023', null, 'hours that close when they open are refused');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.save_team_hours((select v from ids where k = 'deira'), '[null,null,null,null,null,null,null]'::jsonb) $$, '42501', null, 'an agent cannot');
select is((select count(*)::int from public.team_hours where team_id = (select v from ids where k = 'deira')), 7, 'but can read the hours (Deira is now open all week)');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select lives_ok($$ select public.save_team_hours((select v from ids where k = 'mall'), '[{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440},{"opens":0,"closes":1440}]'::jsonb) $$, 'the owner changes any team (Mall now open all week too)');
reset role;

-- ---------------------------------------------------------------------------
-- Rules
-- ---------------------------------------------------------------------------
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('everyone', public.save_sla_policy((select v from ids where k = 'ws'), null, 'Everyone', true, '{}', '{}', false, 60, 15, 480));
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.save_sla_policy((select v from ids where k = 'ws'), null, 'For all', true, '{}', '{}', false, 10, null, null) $$, '42501', null, 'a team manager cannot make a rule for every team');
select throws_ok($$ select public.save_sla_policy((select v from ids where k = 'ws'), null, 'Mall', true, array[(select v from ids where k = 'mall')], '{}', false, 10, null, null) $$, '42501', null, 'or for a team that is not theirs');
insert into ids values ('fast', public.save_sla_policy((select v from ids where k = 'ws'), null, 'Deira fast', true, array[(select v from ids where k = 'deira')], '{}', false, 30, null, null));
select ok((select v from ids where k = 'fast') is not null, 'but can make one for their own team');
select throws_ok($$ select public.save_sla_policy((select v from ids where k = 'ws'), (select v from ids where k = 'everyone'), 'Everyone', true, '{}', '{}', false, 5, null, null) $$, '42501', null, 'and cannot change the rule for every team');
select throws_ok($$ select public.delete_sla_policy((select v from ids where k = 'everyone')) $$, '42501', null, 'or delete it');
select throws_ok($$ select public.save_sla_policy((select v from ids where k = 'ws'), null, 'Empty', true, array[(select v from ids where k = 'deira')], '{}', false, null, null, null) $$, '22023', null, 'a rule must set at least one target');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.save_sla_policy((select v from ids where k = 'ws'), null, 'Odd', true, array[gen_random_uuid()], '{}', false, 5, null, null) $$, '22023', null, 'a rule cannot name a team that does not exist');
insert into ids values ('vip', public.save_sla_policy((select v from ids where k = 'ws'), null, 'VIP quick', true, '{}', '{}', true, 10, null, null));
insert into ids values ('sms', public.save_sla_policy((select v from ids where k = 'ws'), null, 'Texts', true, '{}', array['sms'], false, 5, null, null));
insert into ids values ('mallslow', public.save_sla_policy((select v from ids where k = 'ws'), null, 'Mall resolution', true, array[(select v from ids where k = 'mall')], '{}', false, null, null, 30));
reset role;

select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'deira'), 'email', false, 'first_reply')), 30, 'the strictest first-reply target wins (30 beats 60)');
select is((select policy from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'deira'), 'email', false, 'first_reply')), 'Deira fast', 'and says which rule it came from');
select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'deira'), 'email', true, 'first_reply')), 10, 'a VIP customer gets the VIP rule');
select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'deira'), 'sms', false, 'first_reply')), 5, 'a rule for texts applies to texts only');
select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), 'email', false, 'first_reply')), 60, 'another team gets the general rule');
select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'mall'), 'email', false, 'resolution')), 30, 'a team''s own rule can set a stricter resolution target (30 beats 480)');
select is((select count(*)::int from public.sla_pick((select id from public.workspaces where slug = 'noor'), null, 'email', false, 'first_reply')), 0, 'a business with no rules has no targets');
update public.sla_policies set active = false where id in ((select v from ids where k = 'vip'), (select v from ids where k = 'sms'));
select is((select limit_min from public.sla_pick((select v from ids where k = 'ws'), (select v from ids where k = 'deira'), 'email', true, 'first_reply')), 30, 'a rule that is switched off is ignored');

-- ---------------------------------------------------------------------------
-- Reports: "answered within target" and replies typed in the channel's own app
-- ---------------------------------------------------------------------------
select pg_temp.inbound('r-deira', 'r1@example.com', now() - interval '3 days');
select pg_temp.outbound('r1@example.com', (select v from ids where k = 'hana'), 'inbox', now() - interval '3 days' + interval '20 minutes');
select pg_temp.inbound('r-deira', 'r2@example.com', now() - interval '3 days');
select pg_temp.outbound('r2@example.com', (select v from ids where k = 'hana'), 'inbox', now() - interval '3 days' + interval '40 minutes');
select pg_temp.inbound('r-deira', 'r3@example.com', now() - interval '3 days');
insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, created_at)
  values ((select v from ids where k = 'ws'), pg_temp.conv('r3@example.com'), 'resolved', (select v from ids where k = 'hana'), now() - interval '3 days' + interval '2 hours');
select pg_temp.inbound('r-deira', 'r4@example.com', now() - interval '3 days');
insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, created_at)
  values ((select v from ids where k = 'ws'), pg_temp.conv('r4@example.com'), 'resolved', (select v from ids where k = 'hana'), now() - interval '3 days' + interval '10 minutes');
select pg_temp.inbound('r-deira', 'r5@example.com', now() - interval '3 days');
select pg_temp.outbound('r5@example.com', null, 'channel_app', now() - interval '3 days' + interval '5 minutes');
select pg_temp.inbound('r-deira', 'r6@example.com', now() - interval '3 days');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
create temp table r on commit drop as select public.report_conversations((select v from ids where k = 'ws'), 30, 'UTC') as j;
grant all on r to authenticated;
reset role;
select is((select (j -> 'withinTarget' ->> 'n')::int from r), 5, 'five chats were judged: answered in time, answered late, resolved unanswered after the target, a typed-in-channel reply, and one nobody answered');
select is((select (j -> 'withinTarget' ->> 'ok')::int from r), 2, 'two were answered within the 30 minutes (20 minutes, and 5 minutes typed in the channel''s own app)');
select is((select (j ->> 'firstReplySeconds')::numeric from r), 1200::numeric, 'a reply typed in the channel''s own app counts as a reply in Reports too (median of 5, 20 and 40 minutes)');
-- Earlier chats are finished with before the clocks are checked
update public.conversations set status = 'resolved';

-- ---------------------------------------------------------------------------
-- The clock on a chat (Deira and Mall are open around the clock now, so minutes are plain minutes)
-- ---------------------------------------------------------------------------
select pg_temp.inbound('r-deira', 'a@example.com', now() - interval '20 minutes');
select is(pg_temp.clock('a@example.com', 'first_reply'), 'ok 20.00/30', 'a customer waiting 20 minutes: first reply, ok');
select is(pg_temp.clock('a@example.com', 'resolution'), 'ok 20.00/480', 'the resolution clock runs beside it');
select pg_temp.inbound('r-deira', 'b@example.com', now() - interval '26 minutes');
select is(pg_temp.clock('b@example.com', 'first_reply'), 'warn 26.00/30', 'at 26 of 30 minutes it warns (from 80%)');
select pg_temp.inbound('r-deira', 'c@example.com', now() - interval '45 minutes');
select is(pg_temp.clock('c@example.com', 'first_reply'), 'breach 45.00/30', 'past the target it is a breach');

-- A person's reply ends the wait; the time waited is remembered
select pg_temp.outbound('c@example.com', (select v from ids where k = 'hana'), 'inbox', now() - interval '10 minutes', 'queued');
select is(pg_temp.clock('c@example.com', 'first_reply'), 'none', 'a reply from the inbox stops the first-reply clock');
select is(pg_temp.clock('c@example.com', 'resolution'), 'ok 35.00/480 paused', 'the resolution clock keeps the 35 minutes the customer waited, and pauses');
select pg_temp.inbound('r-deira', 'c@example.com', now() - interval '4 minutes');
select is(pg_temp.clock('c@example.com', 'next_reply'), 'ok 4.00/15', 'the customer writes again: now the next-reply clock runs');
select is(pg_temp.clock('c@example.com', 'first_reply'), 'none', 'and the first-reply clock does not come back');
select is(pg_temp.clock('c@example.com', 'resolution'), 'ok 39.00/480', 'resolution adds the new wait to the old one');

-- Automatic, AI and failed messages do not count
select pg_temp.inbound('r-deira', 'd@example.com', now() - interval '20 minutes');
select pg_temp.outbound('d@example.com', null, 'system', now() - interval '15 minutes');
select pg_temp.outbound('d@example.com', null, 'ai', now() - interval '14 minutes');
select is(pg_temp.clock('d@example.com', 'first_reply'), 'ok 20.00/30', 'an automatic or AI message does not stop the clock');
select pg_temp.inbound('r-deira', 'e@example.com', now() - interval '20 minutes');
select pg_temp.outbound('e@example.com', (select v from ids where k = 'hana'), 'inbox', now() - interval '5 minutes', 'queued');
select is(pg_temp.clock('e@example.com', 'first_reply'), 'none', 'a reply on its way stops the clock');
update public.messages set status = 'failed' where conversation_id = pg_temp.conv('e@example.com') and direction = 'out';
select is(pg_temp.clock('e@example.com', 'first_reply'), 'ok 20.00/30', 'if it fails to send, the clock starts again from the customer''s message');

-- A reply typed in the channel's own app, or the business's phone, stops it too
select pg_temp.inbound('r-deira', 'f@example.com', now() - interval '20 minutes');
select pg_temp.outbound('f@example.com', null, 'phone_app', now() - interval '3 minutes');
select is(pg_temp.clock('f@example.com', 'first_reply'), 'none', 'a reply typed on the business''s phone stops it');

-- The resolution target is flagged while the team waits on the customer
select pg_temp.inbound('r-mall', 'g@example.com', now() - interval '50 minutes');
select pg_temp.outbound('g@example.com', (select v from ids where k = 'omar'), 'inbox', now() - interval '10 minutes');
select is(pg_temp.clock('g@example.com', 'resolution'), 'breach 40.00/30 paused', 'a resolution target passed is flagged even while the customer is the one being waited for');

-- Imported history and resolved chats have no clocks
select pg_temp.inbound('r-deira', 'old@example.com', now() - interval '20 minutes', true);
select is(pg_temp.clock('old@example.com', 'first_reply'), 'none', 'imported history has no clock');
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select public.set_conversation_status(pg_temp.conv('a@example.com'), 'resolved');
reset role;
select is(pg_temp.clock('a@example.com', 'first_reply') || ' ' || pg_temp.clock('a@example.com', 'resolution'), 'none none', 'resolving a chat ends its clocks');
-- (in this test the resolve is stamped now, so move it back to before the customer wrote again)
update public.conversation_events set created_at = now() - interval '10 minutes' where conversation_id = pg_temp.conv('a@example.com') and kind = 'resolved';
select pg_temp.inbound('r-deira', 'a@example.com', now() - interval '2 minutes');
select is(pg_temp.clock('a@example.com', 'first_reply'), 'ok 2.00/30', 'the customer writing again starts a new chat with a fresh first-reply clock');
select is(pg_temp.clock('a@example.com', 'resolution'), 'ok 2.00/480', 'and a fresh resolution clock');
select is((select sla_waited from public.conversations where id = pg_temp.conv('a@example.com')), 0::numeric, 'nothing carries over from the earlier chat');

-- What the signed-in person may see
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.sla_clocks((select v from ids where k = 'ws')) where conversation_id = pg_temp.conv('b@example.com')), 0, 'a manager of another team sees no clocks for Deira''s chats');
select ok((select count(*)::int from public.sla_clocks((select v from ids where k = 'ws')) where conversation_id = pg_temp.conv('g@example.com')) > 0, 'but sees their own team''s');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.sla_clocks((select v from ids where k = 'ws'))), 0, 'another business sees nothing');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select is((select count(*)::int from public.sla_clocks((select v from ids where k = 'ws')) where conversation_id = pg_temp.conv('b@example.com')), 2, 'a Deira agent sees both clocks of a Deira chat');
reset role;

-- What is remembered always matches replaying the chat from its messages
create temp table before_rebuild on commit drop as
  select id, sla_owed_since, sla_chat_started, sla_answered, round(sla_waited, 2) as waited from public.conversations where status = 'open';
select public.sla_rebuild(id) from public.conversations where status = 'open';
select is((select count(*)::int from public.conversations c join before_rebuild b on b.id = c.id
            where (c.sla_owed_since, c.sla_chat_started, c.sla_answered, round(c.sla_waited, 2)) is distinct from (b.sla_owed_since, b.sla_chat_started, b.sla_answered, b.waited)), 0, 'replaying every open chat gives the same facts the triggers kept');

-- ---------------------------------------------------------------------------
-- Alerts
-- ---------------------------------------------------------------------------
update public.conversations set status = 'resolved';
update public.sla_policies set active = false where id = (select v from ids where k = 'mallslow');
select pg_temp.inbound('r-deira', 'warn@example.com', now() - interval '26 minutes');
select pg_temp.inbound('r-deira', 'miss@example.com', now() - interval '45 minutes');
select pg_temp.inbound('r-deira', 'nobody@example.com', now() - interval '50 minutes');
update public.conversations set holder_member_id = (select v from ids where k = 'hana') where id in (pg_temp.conv('warn@example.com'), pg_temp.conv('miss@example.com'));

select is(public.sweep_notifications(), 9, 'the sweep writes nine notices: Hana three, and the owner, Sara and Priya two each');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000005' and n.kind = 'sla_warn'), 1, 'the holder gets a warning at 80%');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000005' and n.kind = 'sla_breach'), 2, 'and a breach for their own chat, and for the one nobody holds (they are on the team)');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000001' and n.kind = 'sla_breach'), 2, 'the owner hears both breaches');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000001' and n.kind = 'sla_warn'), 0, 'but no warnings');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000002' and n.kind = 'sla_breach'), 2, 'the Deira manager hears both');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id in ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000006') and n.kind like 'sla%'), 0, 'the Mall team hears nothing about Deira');
select is(public.sweep_notifications(), 0, 'and nobody is told twice');
select is((select sla_target from public.notifications where kind = 'sla_warn' limit 1), 'first_reply', 'the notice says which target');

-- Answering a chat takes the waiting notice off people''s bell
select pg_temp.outbound('warn@example.com', (select v from ids where k = 'hana'), 'inbox', now());
select public.sweep_notifications();
select is((select count(*)::int from public.notifications where kind = 'sla_warn' and read_at is null), 0, 'once the customer is answered, the warning is read');

-- The workspace can keep it to the holder
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select throws_ok($$ select public.set_sla_alerts((select v from ids where k = 'ws'), 0.8, false) $$, '42501', null, 'a team manager cannot change the alert settings');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.set_sla_alerts((select v from ids where k = 'ws'), 0.75, false) $$, '22023', null, 'only 50, 80 or 90 percent');
select public.set_sla_alerts((select v from ids where k = 'ws'), 0.8, false);
reset role;
select pg_temp.inbound('r-deira', 'later@example.com', now() - interval '40 minutes');
update public.conversations set holder_member_id = (select v from ids where k = 'hana') where id = pg_temp.conv('later@example.com');
select is(public.sweep_notifications(), 1, 'with managers off, a new breach tells only the holder');
select is((select count(*)::int from public.notifications n join public.members m on m.id = n.member_id where m.user_id = '10000000-0000-0000-0000-000000000001' and n.kind = 'sla_breach'), 2, 'and the owner has no new notice');

-- Only the worker runs the sweep
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.sweep_sla() $$, '42501', null, 'signed-in people cannot run the reply-target sweep');
reset role;

select * from finish();
rollback;
