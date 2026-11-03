-- Pilot access (decided 2026-11-03): for the private pilot, creating an account needs an invite code. The check lives in the
-- database, on the table that stores accounts, so it cannot be skipped by calling the sign-up service directly with the
-- public key. Someone invited to a workspace by its owner (a pending row in `invites` for their email) does not need a code.
--
--   app_settings.invite_only   'on' (the default here) or 'off'. The local seed turns it off so test accounts can be created.
--   pilot_invites              codes the founder hands out; each has a number of uses and an optional end date.
--   create_pilot_invite()      makes a code. Run it in the Supabase SQL editor; no signed-in person can call it.
--   signup_allowed()           lets the sign-up page say "that code doesn't work" before it tries; it does not use the code up.

create table public.app_settings (
  key text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('invite_only', 'on');

create table public.pilot_invites (
  id uuid primary key default gen_random_uuid(),
  -- 16 characters, shown to people in groups of four; stored without the dashes.
  code text not null unique check (code ~ '^[A-F0-9]{16}$'),
  note text check (note is null or length(note) <= 200),
  max_uses int not null default 1 check (max_uses between 1 and 1000),
  uses int not null default 0 check (uses >= 0),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
alter table public.pilot_invites enable row level security;
revoke all on public.app_settings, public.pilot_invites from anon, authenticated;

-- "ab12-cd34 ..." to "AB12CD34...": capital letters, no dashes or spaces.
create function public.normalise_invite_code(p_code text) returns text
language sql immutable set search_path = '' as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

-- Is this email, with this code, allowed to create an account? Does not use the code up.
create function public.signup_allowed(p_email text, p_code text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select value from public.app_settings where key = 'invite_only'), 'on') <> 'on'
      or exists (select 1 from public.invites i where i.email = lower(btrim(coalesce(p_email, ''))) and i.accepted_at is null and i.expires_at > now())
      or exists (
        select 1 from public.pilot_invites p
         where p.code = public.normalise_invite_code(p_code)
           and p.revoked_at is null and (p.expires_at is null or p.expires_at > now()) and p.uses < p.max_uses
      )
$$;

-- The gate itself: runs before an account is stored, and uses the code up when that is what let the person in.
create function public.enforce_pilot_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  given text := public.normalise_invite_code(new.raw_user_meta_data ->> 'invite_code');
  taken int;
begin
  if coalesce((select value from public.app_settings where key = 'invite_only'), 'on') <> 'on' then return new; end if;
  if exists (select 1 from public.invites i where i.email = lower(btrim(coalesce(new.email, ''))) and i.accepted_at is null and i.expires_at > now()) then return new; end if;
  update public.pilot_invites p set uses = p.uses + 1
   where p.code = given and p.revoked_at is null and (p.expires_at is null or p.expires_at > now()) and p.uses < p.max_uses;
  get diagnostics taken = row_count;
  if taken = 0 then raise exception 'invite_required' using errcode = 'P0001'; end if;
  return new;
end $$;
create trigger auth_users_pilot_invite before insert on auth.users for each row execute function public.enforce_pilot_invite();

-- Makes a code, for the founder to hand out. Returns it in groups of four, e.g. 4F2A-91CC-07BD-E3A8.
create function public.create_pilot_invite(p_note text default null, p_max_uses int default 1, p_days int default 30) returns text
language plpgsql security definer set search_path = '' as $$
declare
  raw text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));
begin
  insert into public.pilot_invites (code, note, max_uses, expires_at)
  values (raw, left(nullif(btrim(coalesce(p_note, '')), ''), 200), p_max_uses, case when p_days is null then null else now() + make_interval(days => p_days) end);
  return substr(raw, 1, 4) || '-' || substr(raw, 5, 4) || '-' || substr(raw, 9, 4) || '-' || substr(raw, 13, 4);
end $$;

revoke execute on function public.normalise_invite_code(text), public.enforce_pilot_invite(), public.create_pilot_invite(text, int, int) from public, anon, authenticated;
revoke execute on function public.signup_allowed(text, text) from public;
grant execute on function public.signup_allowed(text, text) to anon, authenticated;
grant execute on function public.create_pilot_invite(text, int, int) to service_role;
