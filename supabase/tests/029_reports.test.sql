-- Reports: what counts as a chat, first reply and resolution, who is left out, who may see what, and sales.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall), hana ...05 agent (Deira),
-- aisha ...06 viewer, noor ...07 another business.
begin;
select plan(21);

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
  ('omar', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000003')),
  ('sara', (select m.id from public.members m where m.user_id = '10000000-0000-0000-0000-000000000002'));

insert into public.channels (workspace_id, type, name, external_id, team_id) values
  ((select v from ids where k = 'ws'), 'email', 'Deira support', 'r-deira', (select v from ids where k = 'deira')),
  ((select v from ids where k = 'ws'), 'email', 'Mall support', 'r-mall', (select v from ids where k = 'mall'));

-- Helpers: a moment N days ago at a given hour (UTC), a customer message, a staff message, a resolve
create function pg_temp.at(p_days int, p_hour numeric) returns timestamptz language sql as $$
  select date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' - make_interval(days => p_days) + make_interval(secs => (p_hour * 3600)::int)
$$;
create function pg_temp.inbound(p_ch text, p_addr text, p_name text, p_ext text, p_at timestamptz, p_imported boolean default false) returns void language sql as $$
  select public.ingest_inbound((select id from public.channels where external_id = p_ch), 'email', p_addr, p_name, p_ext, 'text', 'Hi', null, '{}', null, p_at, p_addr, 'Q', p_imported)
$$;
create function pg_temp.outbound(p_addr text, p_member uuid, p_source text, p_ext text, p_at timestamptz) returns void language sql as $$
  insert into public.messages (workspace_id, conversation_id, external_id, direction, source, type, body, sent_at, sent_by_member, status)
  select c.workspace_id, c.id, p_ext, 'out', p_source, 'text', 'Hello', p_at, p_member, 'sent'
    from public.conversations c join public.contact_identities i on i.contact_id = c.contact_id where i.address = p_addr
$$;
create function pg_temp.resolve(p_addr text, p_member uuid, p_at timestamptz) returns void language sql as $$
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, created_at)
  select c.workspace_id, c.id, 'resolved', p_member, p_at
    from public.conversations c join public.contact_identities i on i.contact_id = c.contact_id where i.address = p_addr
$$;

-- Lina: a first chat 3 days ago (an automatic reply, then Hana replies after 20 min, resolved after 2 h),
-- a second chat yesterday (reply after 10 min), and a later message in that same open chat
select pg_temp.inbound('r-deira', 'lina@example.com', 'Lina', 'l1', pg_temp.at(3, 10));
select pg_temp.outbound('lina@example.com', (select v from ids where k = 'hana'), 'system', 'l1-auto', pg_temp.at(3, 10.05));
select pg_temp.outbound('lina@example.com', (select v from ids where k = 'hana'), 'inbox', 'l1-r', pg_temp.at(3, 10 + 20.0 / 60));
select pg_temp.resolve('lina@example.com', (select v from ids where k = 'hana'), pg_temp.at(3, 12));
select pg_temp.inbound('r-deira', 'lina@example.com', 'Lina', 'l2', pg_temp.at(1, 9));
select pg_temp.outbound('lina@example.com', (select v from ids where k = 'hana'), 'inbox', 'l2-r', pg_temp.at(1, 9 + 10.0 / 60));
select pg_temp.inbound('r-deira', 'lina@example.com', 'Lina', 'l3', pg_temp.at(1, 9.5));
-- A customer nobody has replied to
select pg_temp.inbound('r-deira', 'omar-c@example.com', 'Omar C', 'o1', pg_temp.at(2, 14));
-- A Mall chat, replied by Omar after 4 hours
select pg_temp.inbound('r-mall', 'dina@example.com', 'Dina', 'd1', pg_temp.at(1, 8));
select pg_temp.outbound('dina@example.com', (select v from ids where k = 'omar'), 'inbox', 'd1-r', pg_temp.at(1, 12));
-- Imported history never counts
select pg_temp.inbound('r-deira', 'old@example.com', 'Old Customer', 'i1', pg_temp.at(5, 10), true);
-- A chat from 40 days ago belongs to the period before
select pg_temp.inbound('r-deira', 'past@example.com', 'Past Customer', 'p1', pg_temp.at(40, 10));
-- Hana hands the unanswered chat to Omar
insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, to_member_id)
select c.workspace_id, c.id, 'handed_to_person', (select v from ids where k = 'hana'), (select v from ids where k = 'omar')
  from public.conversations c join public.contact_identities i on i.contact_id = c.contact_id where i.address = 'omar-c@example.com';

-- The owner sees everything
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
create temp table r on commit drop as select public.report_conversations((select v from ids where k = 'ws'), 30, 'UTC') as j;
grant all on r to authenticated;
select is((select (j ->> 'total')::int from r), 4, 'four chats: Lina twice, Omar C and Dina (imported and old ones left out)');
select is((select (j ->> 'prevTotal')::int from r), 1, 'and one in the period before');
select is((select (j ->> 'firstReplySeconds')::numeric from r), 1200::numeric, 'the median first reply is 20 minutes (of 10, 20 and 240; automatic replies ignored)');
select is((select (j ->> 'resolutionSeconds')::numeric from r), 7200::numeric, 'resolution is 2 hours for the one resolved chat');
select is((select (j ->> 'resolved')::int from r), 1, 'one chat resolved');
select is((select jsonb_array_length(j -> 'days') from r), 30, 'one entry per day');
select is((select sum((d ->> 'n')::int) from r, jsonb_array_elements(j -> 'days') d), 4::bigint, 'and the days add up to the total');
select is((select sum((h ->> 'n')::int) from r, jsonb_array_elements(j -> 'heat') h), 4::bigint, 'so do the busy-time cells');
select is((select (h ->> 'n')::int from r, jsonb_array_elements(j -> 'heat') h where (h ->> 'block')::int = 5 and (h ->> 'dow')::int = extract(isodow from pg_temp.at(3, 10))::int - 1), 1, 'Lina''s 10:00 chat sits in the 10-12 block of its weekday');
select is((select jsonb_array_length(j -> 'byChannel') from r), 1, 'every chat came through email');
select is((select (e ->> 'n')::int from r, jsonb_array_elements(j -> 'team') e where e ->> 'member' = (select v::text from ids where k = 'hana')), 2, 'Hana handled two chats');
select is((select (e ->> 'resolved')::int from r, jsonb_array_elements(j -> 'team') e where e ->> 'member' = (select v::text from ids where k = 'hana')), 1, 'and resolved one');
select is((select (e ->> 'handedOver')::int from r, jsonb_array_elements(j -> 'team') e where e ->> 'member' = (select v::text from ids where k = 'hana')), 1, 'and handed one over');
select is((select (e ->> 'received')::int from r, jsonb_array_elements(j -> 'team') e where e ->> 'member' = (select v::text from ids where k = 'omar')), 1, 'which Omar received');
select is((public.report_conversations((select v from ids where k = 'ws'), 30, 'UTC', null, 'sms') ->> 'total')::int, 0, 'filtering to a channel with no chats finds none');
reset role;

-- A team manager sees only their team's chats
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((public.report_conversations((select v from ids where k = 'ws'), 30, 'UTC') ->> 'total')::int, 3, 'the Deira manager sees the three Deira chats, not the Mall one');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.report_conversations((select v from ids where k = 'ws'), 30, 'UTC') $$, '42501', null, 'an agent has no reports');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.report_conversations((select v from ids where k = 'ws'), 14, 'UTC') $$, '22023', null, 'only 7, 30 or 90 days');
reset role;

-- Sales: Hana's deals in Deira
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('d1', public.create_deal((select v from ids where k = 'ws'), 'Sofa', null, 100000));
insert into ids values ('d2', public.create_deal((select v from ids where k = 'ws'), 'Table', null, 50000));
insert into ids values ('d3', public.create_deal((select v from ids where k = 'ws'), 'Lamp', null, 20000));
select public.close_deal_won((select v from ids where k = 'd1'), 90000);
select public.close_deal_lost((select v from ids where k = 'd3'), 'Price');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
create temp table s on commit drop as select public.report_sales((select v from ids where k = 'ws'), 30, 'UTC') as j;
grant all on s to authenticated;
select is((select (j -> 'won' ->> 'value')::int from s), 90000, 'sales: the owner sees the won value');
select is((select j -> 'reasons' -> 0 ->> 'reason' from s), 'Price', 'and why a deal was lost');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((public.report_sales((select v from ids where k = 'ws'), 30, 'UTC') ->> 'money')::boolean, false, 'a support manager gets counts, not money');
reset role;

select * from finish();
rollback;
