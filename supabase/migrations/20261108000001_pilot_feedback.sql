-- Pilot feedback (decided 2026-11-05): people in the pilot can tell the founder what is broken, confusing or missing, from inside
-- Relay, with no email set up. Rows are written by send_feedback() and are not readable by anyone who is signed in, not even the
-- person who wrote them: the founder reads them in the Supabase table editor or with
--   select created_at, kind, body, page, w.name as business, m.display_name as person
--     from public.pilot_feedback f join public.workspaces w on w.id = f.workspace_id left join public.members m on m.id = f.member_id
--    order by f.created_at desc;

create table public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  kind text not null check (kind in ('broken', 'confusing', 'wish', 'other')),
  body text not null check (length(body) between 1 and 4000),
  -- The screen the person was on when they opened the form (a path like /w/acme/inbox), never anything typed.
  page text check (page is null or length(page) <= 200),
  created_at timestamptz not null default now()
);
create index pilot_feedback_recent on public.pilot_feedback (created_at desc);

alter table public.pilot_feedback enable row level security;
revoke all on public.pilot_feedback from anon, authenticated;

create function public.send_feedback(p_workspace uuid, p_kind text, p_body text, p_page text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.member_id(p_workspace);
  body text := btrim(coalesce(p_body, ''));
begin
  if me is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind not in ('broken', 'confusing', 'wish', 'other') then raise exception 'bad_kind' using errcode = '22023'; end if;
  if length(body) not between 1 and 4000 then raise exception 'bad_body' using errcode = '22023'; end if;
  -- Thirty a day is more than anyone means to send; it only stops a stuck script.
  if (select count(*) from public.pilot_feedback f where f.member_id = me and f.created_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;
  insert into public.pilot_feedback (workspace_id, member_id, kind, body, page)
  values (p_workspace, me, p_kind, body, left(nullif(btrim(coalesce(p_page, '')), ''), 200));
end $$;

revoke execute on function public.send_feedback(uuid, text, text, text) from public, anon;
grant execute on function public.send_feedback(uuid, text, text, text) to authenticated;
