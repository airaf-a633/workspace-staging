-- The gated channels (decided 2026-11-02).
--
-- TikTok, WeChat and Apple Messages cannot be connected by a customer yet: each needs an approval, a contract or a
-- provider that Relay does not have. Their screens explain what is needed and offer "Request access", which saves the
-- request so the owner sees it was made and the Relay team can read what customers ask for. Nothing is sent anywhere.
create table public.channel_access_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  channel text not null check (channel in ('tiktok', 'wechat', 'apple')),
  note text check (length(note) <= 500),
  requested_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workspace_id, channel)
);
alter table public.channel_access_requests enable row level security;
create policy channel_access_requests_read on public.channel_access_requests for select to authenticated using ((select public.is_member(workspace_id)));

-- Owners and admins ask once per channel; asking again only changes the note.
create function public.request_channel_access(p_workspace uuid, p_channel text, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_channel not in ('tiktok', 'wechat', 'apple') then raise exception 'bad_channel' using errcode = '22023'; end if;
  insert into public.channel_access_requests (workspace_id, channel, note, requested_by)
  values (p_workspace, p_channel, nullif(btrim(coalesce(p_note, '')), ''), public.member_id(p_workspace))
  on conflict (workspace_id, channel) do update set note = excluded.note;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'request_access', 'channels', p_channel, jsonb_build_object('channel', p_channel));
end $$;
revoke all on function public.request_channel_access(uuid, text, text) from public, anon;
grant execute on function public.request_channel_access(uuid, text, text) to authenticated;

-- Worker and web routes only. Replaces named credentials of a channel (a rotated access token, for example) without
-- touching the others. Used by channels whose tokens expire and are renewed by the worker (X).
create function public.store_channel_secrets(p_channel uuid, p_secrets jsonb) returns void
language sql security definer set search_path = '' as $$
  select public.put_channel_secrets(p_channel, p_secrets)
$$;
revoke all on function public.store_channel_secrets(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.store_channel_secrets(uuid, jsonb) to service_role;
