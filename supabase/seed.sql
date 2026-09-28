-- Local development seed. Runs on `pnpm db:reset`. Never run against staging or production.
--
-- Two workspaces, so isolation is visible while developing:
--   Qamar Electronics (qamar): one member per role, two branch teams.
--   Noor Salon (noor):          a separate business run by an outsider.
-- Every seed user's password is: Password1234

do $$
declare
  pw text := extensions.crypt('Password1234', extensions.gen_salt('bf'));
  u record;
  ws_qamar uuid;
  ws_noor uuid;
  deira uuid;
  mall uuid;
begin
  -- Users: (id, email, name)
  for u in select * from (values
    ('10000000-0000-0000-0000-000000000001'::uuid, 'khalid@qamar.test', 'Khalid'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'sara@qamar.test',   'Sara'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'omar@qamar.test',   'Omar'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'priya@qamar.test',  'Priya'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'hana@qamar.test',   'Hana'),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'aisha@qamar.test',  'Aisha'),
    ('10000000-0000-0000-0000-000000000007'::uuid, 'noor@noor.test',    'Noor')
  ) as v(id, email, name)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, pw, now(),
            '{"provider":"email","providers":["email"]}', jsonb_build_object('name', u.name), now(), now(),
            '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, 'email',
            jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), now(), now(), now());
  end loop;

  -- Qamar Electronics, created by Khalid through the same function the app uses.
  perform set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
  ws_qamar := public.create_workspace('Qamar Electronics', 'qamar', 'Khalid');

  insert into public.teams (workspace_id, name, is_branch) values (ws_qamar, 'Deira shop', true) returning id into deira;
  insert into public.teams (workspace_id, name, is_branch) values (ws_qamar, 'Dubai Mall shop', true) returning id into mall;

  insert into public.members (workspace_id, user_id, role_id, display_name)
  select ws_qamar, v.id, r.id, v.name
  from (values
    ('10000000-0000-0000-0000-000000000002'::uuid, 'Sara',  'sales_manager'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'Omar',  'support_manager'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'Priya', 'ops_manager'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'Hana',  'agent'),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'Aisha', 'viewer')
  ) as v(id, name, role_key)
  join public.roles r on r.workspace_id = ws_qamar and r.key = v.role_key;

  -- Teams: Khalid is already in General. Sara and Hana run Deira; Omar and Aisha the mall; Priya both.
  insert into public.team_members (workspace_id, team_id, member_id)
  select ws_qamar, t.team_id, m.id
  from (values
    ('10000000-0000-0000-0000-000000000002'::uuid, deira),
    ('10000000-0000-0000-0000-000000000005'::uuid, deira),
    ('10000000-0000-0000-0000-000000000003'::uuid, mall),
    ('10000000-0000-0000-0000-000000000006'::uuid, mall),
    ('10000000-0000-0000-0000-000000000004'::uuid, deira),
    ('10000000-0000-0000-0000-000000000004'::uuid, mall)
  ) as t(user_id, team_id)
  join public.members m on m.workspace_id = ws_qamar and m.user_id = t.user_id;

  -- Noor Salon, a separate business.
  perform set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000007","role":"authenticated"}', true);
  ws_noor := public.create_workspace('Noor Salon', 'noor', 'Noor');

  perform set_config('request.jwt.claims', '', true);
end $$;
