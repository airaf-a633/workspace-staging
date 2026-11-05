-- Pilot feedback: members can send it, nobody signed in can read it, it is checked and limited, and erasing a business removes it.
-- Seed: khalid ...01 owner of qamar; hana ...05 agent; noor ...07 owns the other business.
begin;
select plan(13);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create temp table ids (k text primary key, v uuid) on commit drop;
grant all on ids to authenticated;
insert into ids values ('ws', (select id from public.workspaces where slug = 'qamar')), ('noor', (select id from public.workspaces where slug = 'noor'));

select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select lives_ok($$ select public.send_feedback((select v from ids where k = 'ws'), 'broken', '  The inbox did not load  ', '/w/qamar/inbox') $$, 'an agent sends feedback');
select throws_ok($$ select public.send_feedback((select v from ids where k = 'noor'), 'broken', 'Not my business', null) $$, '42501', null, 'but not into a business they do not belong to');
select throws_ok($$ select public.send_feedback((select v from ids where k = 'ws'), 'angry', 'x', null) $$, '22023', null, 'the kind must be one of the four');
select throws_ok($$ select public.send_feedback((select v from ids where k = 'ws'), null, 'x', null) $$, '22023', null, 'a missing kind is refused the same way');
select throws_ok($$ select public.send_feedback((select v from ids where k = 'ws'), 'wish', '   ', null) $$, '22023', null, 'an empty message is refused');
select throws_ok($$ select public.send_feedback((select v from ids where k = 'ws'), 'wish', repeat('x', 4001), null) $$, '22023', null, 'and so is a very long one');
select throws_ok($$ select count(*) from public.pilot_feedback $$, '42501', null, 'nobody signed in can read feedback, not even the sender');
reset role;

select is((select body from public.pilot_feedback), 'The inbox did not load', 'it is stored, trimmed, with the screen it came from');
select is((select page from public.pilot_feedback), '/w/qamar/inbox', 'and the screen it came from');

-- A stuck script is stopped
select pg_temp.act_as('10000000-0000-0000-0000-000000000005');
select public.send_feedback((select v from ids where k = 'ws'), 'other', 'n' || g, null) from generate_series(1, 29) g;
select throws_ok($$ select public.send_feedback((select v from ids where k = 'ws'), 'other', 'one too many', null) $$, 'P0001', 'too_many', 'thirty in a day is the limit');
reset role;
set local role anon;
select throws_ok($$ select public.send_feedback('00000000-0000-0000-0000-000000000000', 'other', 'x', null) $$, '42501', null, 'someone who is not signed in cannot send');
reset role;

-- A business's feedback goes with it when the business is deleted (workspace deletion is guarded by an owner rule, so the
-- foreign key is checked directly: 'c' means cascade)
select is((select confdeltype::text from pg_constraint where conrelid = 'public.pilot_feedback'::regclass and confrelid = 'public.workspaces'::regclass), 'c', 'feedback is deleted with its business');
select is((select confdeltype::text from pg_constraint where conrelid = 'public.pilot_feedback'::regclass and confrelid = 'public.members'::regclass), 'n', 'and kept, without a name, if the person is removed');

select * from finish();
rollback;
