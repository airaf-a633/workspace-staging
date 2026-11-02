-- Deals: who sees what (money apart), moving, discounts, closing, and the privacy tools.
-- Seed: khalid ...01 owner, sara ...02 sales manager (Deira), omar ...03 support manager (Mall), hana ...05 agent (Deira),
-- aisha ...06 viewer, noor ...07 another business.
begin;
select plan(34);

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
                       ('hana', (select m.id::text from public.members m where m.user_id = '10000000-0000-0000-0000-000000000005'));
insert into public.channels (workspace_id, type, name, external_id, team_id)
values ((select v from ids where k = 'ws')::uuid, 'email', 'Support', 'e26', (select v from ids where k = 'deira')::uuid);
select public.ingest_inbound((select id from public.channels where external_id = 'e26'), 'email', 'rana@example.com', 'Rana Aziz', '<a26@x>', 'text', 'Hi', null, '{}', null, now(), '<a26@x>', 'Sofa');
select public.ingest_inbound((select id from public.channels where external_id = 'e26'), 'email', 'rana2@example.com', 'Rana A.', '<b26@x>', 'text', 'Hi again', null, '{}', null, now(), '<b26@x>', 'Table');
insert into ids select 'rana', contact_id::text from public.contact_identities where address = 'rana@example.com';
insert into ids select 'rana2', contact_id::text from public.contact_identities where address = 'rana2@example.com';

-- Every workspace has one pipeline with the three stages
select is((select count(*)::int from public.pipelines where workspace_id = (select v::uuid from ids where k = 'ws') and is_default), 1, 'the workspace has one default pipeline');
select is((select string_agg(key, ',' order by position) from public.pipeline_stages where workspace_id = (select v::uuid from ids where k = 'ws')), 'new,quoted,negotiating', 'with New, Quoted and Negotiating');

-- An agent creates a deal for herself, worth 1,000.00
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
insert into ids values ('deal', public.create_deal((select v::uuid from ids where k = 'ws'), 'Sofa set', (select v::uuid from ids where k = 'rana'), 100000)::text);
select is((select count(*)::int from public.deals), 1, 'an agent can create a deal');
select throws_ok($$ select public.create_deal((select v::uuid from ids where k = 'ws'), 'For Sara', null, 0, (select v::uuid from ids where k = 'sara')) $$, '42501', null, 'but only one she owns');
select is((select count(*)::int from public.deal_values), 1, 'she sees her own deal''s value');
reset role;

-- Who sees it
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select is((select count(*)::int from public.deals), 1, 'the sales manager sees it');
select is((select count(*)::int from public.deal_values), 1, 'and its value');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select is((select count(*)::int from public.deals), 1, 'the support manager sees that the deal exists');
select is((select count(*)::int from public.deal_values), 0, 'but not its money');
select throws_ok($$ select public.update_deal((select v::uuid from ids where k = 'deal'), '{"title":"Hacked"}') $$, '42501', null, 'and cannot change it');
select throws_ok($$ select public.add_deal_note((select v::uuid from ids where k = 'deal'), 'hi') $$, '42501', null, 'or add a note');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000006');
select is((select count(*)::int from public.deals), 0, 'a viewer sees no deals');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000007');
select is((select count(*)::int from public.deals), 0, 'another business sees none');
reset role;

-- Moving, and a discount
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.update_deal((select v::uuid from ids where k = 'deal'), '{"stage":"quoted"}') $$, 'the owner moves the deal to Quoted');
select is((select count(*)::int from public.deal_events where kind = 'moved'), 1, 'which is logged');
select throws_ok($$ select public.update_deal((select v::uuid from ids where k = 'deal'), '{"stage":"nowhere"}') $$, '22023', null, 'an unknown stage is refused');
insert into ids values ('approval', public.request_discount((select v::uuid from ids where k = 'deal'), 10, 'Loyal customer')::text);
select throws_ok($$ select public.request_discount((select v::uuid from ids where k = 'deal'), 5) $$, 'P0001', 'already_pending', 'one request at a time');
select throws_ok($$ select public.decide_discount((select v::uuid from ids where k = 'approval'), true) $$, '42501', null, 'she cannot approve her own request');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000003');
select throws_ok($$ select public.decide_discount((select v::uuid from ids where k = 'approval'), true) $$, '42501', null, 'someone without the approve right cannot decide');
reset role;
select pg_temp.act_as('10000000-0000-0000-0000-000000000002');
select lives_ok($$ select public.decide_discount((select v::uuid from ids where k = 'approval'), true, 'Fine, go ahead') $$, 'the sales manager approves');
reset role;
select is((select value_minor from public.deal_values where deal_id = (select v::uuid from ids where k = 'deal')), 90000::bigint, 'the value drops by 10 percent');
select is((select count(*)::int from public.deal_notes where body = 'Fine, go ahead'), 1, 'and the note is kept on the deal');

-- Closing
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select throws_ok($$ select public.close_deal_won((select v::uuid from ids where k = 'deal'), 0) $$, '22023', null, 'Won needs a final value');
select lives_ok($$ select public.close_deal_won((select v::uuid from ids where k = 'deal'), 85000) $$, 'the owner marks it won with the final value');
select throws_ok($$ select public.update_deal((select v::uuid from ids where k = 'deal'), '{"stage":"new"}') $$, 'P0001', 'closed', 'a closed deal cannot be moved');
select lives_ok($$ select public.reopen_deal((select v::uuid from ids where k = 'deal')) $$, 'it can be reopened');
select throws_ok($$ select public.close_deal_lost((select v::uuid from ids where k = 'deal'), 'Boredom') $$, '22023', null, 'Lost needs a reason from the list');
select lives_ok($$ select public.close_deal_lost((select v::uuid from ids where k = 'deal'), 'Price') $$, 'and a real one works');
reset role;
select is((select status || '/' || lost_reason from public.deals where id = (select v::uuid from ids where k = 'deal')), 'lost/Price', 'the deal is lost for that reason');

-- Merging two customers keeps their deals; erasing deletes them
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
insert into ids values ('deal2', public.create_deal((select v::uuid from ids where k = 'ws'), 'Table', (select v::uuid from ids where k = 'rana2'), 5000)::text);
select lives_ok($$ select public.merge_contacts((select v::uuid from ids where k = 'rana'), (select v::uuid from ids where k = 'rana2')) $$, 'the owner merges the duplicate customer');
select is((select count(*)::int from public.deals where contact_id = (select v::uuid from ids where k = 'rana')), 2, 'both deals now belong to the kept customer');
select is((select jsonb_array_length(public.export_contacts(array[(select v::uuid from ids where k = 'rana')])-> 0 -> 'deals')), 2, 'the export lists them');
select is((select public.erase_contacts(array[(select v::uuid from ids where k = 'rana')])), 1, 'the owner erases the customer');
select is((select count(*)::int from public.deals where contact_id = (select v::uuid from ids where k = 'rana')), 0, 'and their deals are gone');
reset role;

select * from finish();
rollback;
