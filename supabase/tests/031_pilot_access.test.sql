-- Pilot access: creating an account needs an invite code (or a workspace invitation), the gate cannot be skipped, codes are used up,
-- end and can be revoked, and nobody signed in can make or read codes.
-- Seed: khalid ...01 owner of qamar; noor ...07 owns the other business.
begin;
select plan(30);

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;

create function pg_temp.sign_up(p_email text, p_code text default null) returns void language sql as $$
  insert into auth.users (id, email, raw_user_meta_data)
  values (gen_random_uuid(), p_email, case when p_code is null then '{}'::jsonb else jsonb_build_object('invite_code', p_code) end)
$$;

-- The switch: off lets anyone in (the local seed turns it off), on is how the migration ships
select lives_ok($$ select pg_temp.sign_up('anyone@example.com') $$, 'with the gate off anybody can create an account');
update public.app_settings set value = 'on' where key = 'invite_only';
select throws_ok($$ select pg_temp.sign_up('stranger@example.com') $$, 'P0001', 'invite_required', 'with the gate on, no code means no account');
select throws_ok($$ select pg_temp.sign_up('stranger@example.com', '1234-5678-ABCD-EF01') $$, 'P0001', 'invite_required', 'and a made-up code does not work');
select is((select count(*)::int from auth.users where email = 'stranger@example.com'), 0, 'nothing was stored for them');

-- A real code
create temp table codes (k text primary key, v text) on commit drop;
insert into codes values ('one', public.create_pilot_invite('Acme pilot', 1, 30));
insert into codes values ('three', public.create_pilot_invite('Three seats', 3, 30));
select matches((select v from codes where k = 'one'), '^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$', 'a code is four groups of four');
select is((select public.signup_allowed('new@example.com', (select v from codes where k = 'one'))), true, 'the sign-up page can ask whether a code works');
select is((select uses from public.pilot_invites where note = 'Acme pilot'), 0, 'and asking does not use it up');
select lives_ok(format($$ select pg_temp.sign_up('acme@example.com', %L) $$, (select v from codes where k = 'one')), 'the code lets someone in');
select is((select uses from public.pilot_invites where note = 'Acme pilot'), 1, 'and counts one use');
select throws_ok(format($$ select pg_temp.sign_up('second@example.com', %L) $$, (select v from codes where k = 'one')), 'P0001', 'invite_required', 'a one-use code does not work twice');
select is((select public.signup_allowed('second@example.com', (select v from codes where k = 'one'))), false, 'and the sign-up page says so');
select lives_ok(format($$ select pg_temp.sign_up('typed@example.com', %L) $$, lower(replace((select v from codes where k = 'three'), '-', ' '))), 'a code typed in lower case with spaces still works');
select is((select uses from public.pilot_invites where note = 'Three seats'), 1, 'it counts');

-- Ended and revoked codes
update public.pilot_invites set expires_at = now() - interval '1 minute' where note = 'Three seats';
select throws_ok(format($$ select pg_temp.sign_up('late@example.com', %L) $$, (select v from codes where k = 'three')), 'P0001', 'invite_required', 'a code past its end date does not work');
update public.pilot_invites set expires_at = null, revoked_at = now() where note = 'Three seats';
select throws_ok(format($$ select pg_temp.sign_up('revoked@example.com', %L) $$, (select v from codes where k = 'three')), 'P0001', 'invite_required', 'a revoked code does not work');

-- A workspace invitation is enough on its own
insert into public.invites (workspace_id, email, role_id, token_hash)
select w.id, 'colleague@example.com', r.id, encode(sha256(convert_to('secret-token-031', 'UTF8')), 'hex')
  from public.workspaces w join public.roles r on r.workspace_id = w.id and r.key = 'agent' where w.slug = 'qamar';
select is((select public.signup_allowed('Colleague@Example.com', null)), false, 'the code check no longer says anything about workspace invitations');
select is((select public.invite_email_matches('secret-token-031', 'Colleague@Example.com')), true, 'whoever holds the invitation link can ask whether their address is the invited one (any capitals)');
select is((select public.invite_email_matches('secret-token-031', 'other@example.com')), false, 'and is told if it is not');
select is((select public.invite_email_matches('wrong-token', 'colleague@example.com')), false, 'without the link nothing is revealed');
select lives_ok($$ select pg_temp.sign_up('colleague@example.com') $$, 'and does');
update public.invites set accepted_at = now() where email = 'colleague@example.com';
select throws_ok($$ select pg_temp.sign_up('colleague@example.com') $$, 'P0001', 'invite_required', 'but an invitation already used does not open the door again');

-- Nobody signed in can make or read codes
select pg_temp.act_as('10000000-0000-0000-0000-000000000001');
select throws_ok($$ select public.create_pilot_invite('Sneaky', 99, 30) $$, '42501', null, 'the owner of a workspace cannot make pilot codes');
select throws_ok($$ select count(*) from public.pilot_invites $$, '42501', null, 'or read them');
select throws_ok($$ select public.signup_allowed('x@example.com', 'nope') $$, '42501', null, 'nor ask the code check directly: only the server can');
select throws_ok($$ select public.invite_email_matches('t', 'x@example.com') $$, '42501', null, 'or the invitation check');
reset role;
set local role anon;
select throws_ok($$ select public.signup_allowed('x@example.com', 'nope') $$, '42501', null, 'and the same for someone not signed in');
reset role;

-- What someone who is not signed in cannot do at all (no leftover sign-in from the steps above)
select set_config('request.jwt.claims', '', true);
set local role anon;
select throws_ok($$ select public.create_workspace('Evil', 'evil-co', 'Eve') $$, '42501', null, 'a visitor cannot create a workspace');
select throws_ok($$ select public.accept_invite('abc', 'Eve') $$, '42501', null, 'or accept an invitation');
select throws_ok($$ select public.is_member(gen_random_uuid()) $$, '42501', null, 'or ask who belongs to a workspace');
select throws_ok($$ select count(*) from public.channel_access_requests $$, '42501', null, 'or read a table of requests');
reset role;

select * from finish();
rollback;
