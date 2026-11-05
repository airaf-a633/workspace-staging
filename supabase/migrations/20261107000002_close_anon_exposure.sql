-- Closing what a visitor who is not signed in can reach (found by scripts/db-audit-exposure.mjs, 2026-11-03).
-- These functions already refuse a caller with no account (they check auth.uid()), but Supabase grants execute on new functions to
-- the anonymous role by default, and the first migrations never took it back. People who are signed in keep every right they had;
-- the row-level-security policies that call these helpers apply to signed-in roles only.
revoke execute on function
  public.accept_invite(text, text),
  public.create_custom_role(uuid, text, text),
  public.create_invite(uuid, text, uuid, uuid[]),
  public.create_workspace(text, text, text),
  public.has_permission(uuid, text),
  public.in_team(uuid, uuid),
  public.is_member(uuid),
  public.is_owner(uuid),
  public.member_id(uuid),
  public.permission_scope(uuid, text)
  from public, anon;
grant execute on function
  public.accept_invite(text, text),
  public.create_custom_role(uuid, text, text),
  public.create_invite(uuid, text, uuid, uuid[]),
  public.create_workspace(text, text, text),
  public.has_permission(uuid, text),
  public.in_team(uuid, uuid),
  public.is_member(uuid),
  public.is_owner(uuid),
  public.member_id(uuid),
  public.permission_scope(uuid, text)
  to authenticated, service_role;

-- One table was never taken back from the anonymous role (row-level security was on, so it returned nothing, but it should not hold the right).
revoke all on public.channel_access_requests from anon;
