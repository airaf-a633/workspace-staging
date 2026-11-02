-- Notifications (decided 2026-11-04): the things that need *this* person, stored so they have a read state and a history.
-- Written by triggers on the same tables the actions already write to, so no action function was rewritten:
--   handover, mention, collab_request     from conversation_events / conversation_notes
--   channel_broken                        from channels (owners and anyone who manages numbers)
--   discount_asked / approved / declined  from deal_approvals
--   task_assigned                         from tasks
--   task_late                             from sweep_notifications(), which the worker runs every few minutes
-- A notice is only written for someone who may see what it is about, because its text quotes a note or names a customer.
-- Amounts are never stored here (deal values are kept apart on purpose); a discount notice carries the percent only.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('handover', 'mention', 'collab_request', 'channel_broken', 'discount_asked', 'discount_approved', 'discount_declined', 'task_assigned', 'task_late')),
  actor_member_id uuid references public.members (id) on delete set null,
  -- The customer, channel, deal or task it is about, in words, as it was when it happened.
  subject text not null check (length(subject) <= 200),
  quote text check (length(quote) <= 300),
  percent numeric(5, 2),
  -- Where it leads. A customer's erasure removes their notices; deleting the thing it is about removes the notice.
  contact_id uuid references public.contacts (id) on delete cascade,
  conversation_id uuid references public.conversations (id) on delete cascade,
  deal_id uuid references public.deals (id) on delete cascade,
  task_id uuid references public.tasks (id) on delete cascade,
  channel_id uuid references public.channels (id) on delete cascade,
  -- Stops the same thing notifying the same person twice.
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_member on public.notifications (member_id, created_at desc);
create index notifications_task on public.notifications (task_id) where task_id is not null;
create unique index notifications_dedupe on public.notifications (member_id, dedupe_key) where dedupe_key is not null;

alter table public.notifications enable row level security;
create policy notifications_read on public.notifications for select to authenticated
  using (member_id = (select public.member_id(workspace_id)));
revoke all on public.notifications from anon;
revoke insert, update, delete, truncate on public.notifications from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Helpers (not callable by signed-in users)
-- ---------------------------------------------------------------------------

-- What a role lets this member do, for people other than the caller (permission_scope() answers only for the caller).
create function public.member_scope(p_member uuid, p_permission text)
returns public.permission_scope language sql stable security definer set search_path = '' as $$
  select coalesce((
    select rp.scope from public.members m
    join public.role_permissions rp on rp.role_id = m.role_id
    where m.id = p_member and m.status = 'active' and rp.permission = p_permission
  ), 'none'::public.permission_scope)
$$;

-- Same rule as in_scope(), for any member: all, the team's, or their own.
create function public.member_in_scope(p_member uuid, p_permission text, p_team uuid, p_owner uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(case public.member_scope(p_member, p_permission)
    when 'all' then true
    when 'team' then p_owner = p_member
      or (p_team is not null and exists (select 1 from public.team_members tm where tm.member_id = p_member and tm.team_id = p_team))
    when 'own' then p_owner = p_member
    else false
  end, false)
$$;

-- Same rule as covers_conversation(), for any member.
create function public.member_covers_conversation(p_member uuid, p_conversation uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case public.member_scope(p_member, p_permission)
      when 'all' then true
      when 'team' then c.holder_member_id = p_member
        or exists (select 1 from public.conversation_collaborators cc where cc.conversation_id = c.id and cc.member_id = p_member)
        or (c.team_id is not null and exists (select 1 from public.team_members tm where tm.member_id = p_member and tm.team_id = c.team_id))
      when 'own' then c.holder_member_id = p_member
        or exists (select 1 from public.conversation_collaborators cc where cc.conversation_id = c.id and cc.member_id = p_member)
      else false
    end
    from public.conversations c where c.id = p_conversation
  ), false)
$$;

-- Writes one notice. Never to the person who did the thing, never to someone who isn't an active member.
create function public.notify(
  p_workspace uuid, p_member uuid, p_kind text, p_actor uuid, p_subject text,
  p_quote text default null, p_percent numeric default null,
  p_contact uuid default null, p_conversation uuid default null, p_deal uuid default null, p_task uuid default null, p_channel uuid default null,
  p_dedupe text default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (workspace_id, member_id, kind, actor_member_id, subject, quote, percent, contact_id, conversation_id, deal_id, task_id, channel_id, dedupe_key)
  select p_workspace, p_member, p_kind, p_actor, left(coalesce(nullif(btrim(p_subject), ''), '-'), 200), left(nullif(btrim(coalesce(p_quote, '')), ''), 300), p_percent,
         p_contact, p_conversation, p_deal, p_task, p_channel, p_dedupe
   where p_member is not null and p_member is distinct from p_actor
     and exists (select 1 from public.members m where m.id = p_member and m.workspace_id = p_workspace and m.status = 'active')
  on conflict (member_id, dedupe_key) where dedupe_key is not null do nothing
$$;

-- ---------------------------------------------------------------------------
-- Chats: handover, collaboration request, @mention
-- ---------------------------------------------------------------------------

create function public.notify_conversation_event() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
  kind text;
  who record;
begin
  if new.kind = 'handed_to_person' then recipient := new.to_member_id; kind := 'handover';
  elsif new.kind = 'asked_collab' then recipient := new.holder_member_id; kind := 'collab_request';
  else return new;
  end if;
  if recipient is null or not public.member_covers_conversation(recipient, new.conversation_id, 'conversations.view') then return new; end if;
  select c.contact_id, coalesce(ct.name, ct.profile_name, ct.email, ct.phone, 'Website visitor') as label into who
    from public.conversations c join public.contacts ct on ct.id = c.contact_id where c.id = new.conversation_id;
  perform public.notify(new.workspace_id, recipient, kind, new.actor_member_id, who.label, new.note, null, who.contact_id, new.conversation_id, null, null, null, 'event:' || new.id);
  return new;
end $$;
create trigger conversation_events_notify after insert on public.conversation_events
  for each row execute function public.notify_conversation_event();

create function public.notify_note_mentions() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  m uuid;
  who record;
begin
  if cardinality(new.mentions) = 0 then return new; end if;
  select c.contact_id, coalesce(ct.name, ct.profile_name, ct.email, ct.phone, 'Website visitor') as label into who
    from public.conversations c join public.contacts ct on ct.id = c.contact_id where c.id = new.conversation_id;
  for m in select distinct unnest(new.mentions) loop
    if public.member_covers_conversation(m, new.conversation_id, 'conversations.view') then
      perform public.notify(new.workspace_id, m, 'mention', new.author_member_id, who.label, new.body, null, who.contact_id, new.conversation_id, null, null, null, 'note:' || new.id);
    end if;
  end loop;
  return new;
end $$;
create trigger conversation_notes_notify after insert on public.conversation_notes
  for each row execute function public.notify_note_mentions();

-- ---------------------------------------------------------------------------
-- A channel that stopped working: everyone who manages numbers hears, once a day at most
-- ---------------------------------------------------------------------------

create function public.notify_channel_broken() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m uuid;
begin
  if new.status = 'disconnected' and old.status is distinct from 'disconnected' then
    for m in select mm.id from public.members mm where mm.workspace_id = new.workspace_id and mm.status = 'active'
                and public.member_scope(mm.id, 'numbers.manage') = 'all' loop
      perform public.notify(new.workspace_id, m, 'channel_broken', null, new.name, null, null, null, null, null, null, new.id, 'broken:' || new.id || ':' || current_date);
    end loop;
  end if;
  return new;
end $$;
create trigger channels_notify after update of status on public.channels
  for each row execute function public.notify_channel_broken();

-- ---------------------------------------------------------------------------
-- Discounts: the people who can approve hear when one is asked; the asker hears the answer
-- ---------------------------------------------------------------------------

create function public.notify_discount() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d public.deals%rowtype;
  m uuid;
begin
  select * into d from public.deals where id = new.deal_id;
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      for m in select mm.id from public.members mm where mm.workspace_id = new.workspace_id and mm.status = 'active'
                  and mm.id is distinct from new.requested_by
                  and public.member_in_scope(mm.id, 'deals.approve', d.team_id, d.owner_member_id) loop
        perform public.notify(new.workspace_id, m, 'discount_asked', new.requested_by, d.title, new.note, new.percent, d.contact_id, null, d.id, null, null, 'approval:' || new.id);
      end loop;
    end if;
  elsif old.status = 'pending' and new.status in ('approved', 'declined') then
    perform public.notify(new.workspace_id, new.requested_by, 'discount_' || new.status, new.decided_by, d.title, new.decision_note, new.percent, d.contact_id, null, d.id, null, null, 'decision:' || new.id);
    -- The question is answered, so it no longer waits on anyone else.
    update public.notifications set read_at = coalesce(read_at, now()) where dedupe_key = 'approval:' || new.id;
  end if;
  return new;
end $$;
create trigger deal_approvals_notify after insert or update of status on public.deal_approvals
  for each row execute function public.notify_discount();

-- ---------------------------------------------------------------------------
-- Tasks: given to you by someone else; finished means the notices about it are read
-- ---------------------------------------------------------------------------

create function public.notify_task() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.done_at is not null and old.done_at is null then
    update public.notifications set read_at = now() where task_id = new.id and read_at is null;
  end if;
  -- A repeat made by finishing the last one is not "given to you".
  if new.owner_member_id is not null and new.source_task_id is null and new.done_at is null
     and (tg_op = 'INSERT' or new.owner_member_id is distinct from old.owner_member_id) then
    perform public.notify(new.workspace_id, new.owner_member_id, 'task_assigned', public.member_id(new.workspace_id), new.text, null, null, new.contact_id, null, new.deal_id, new.id, null, null);
  end if;
  return new;
end $$;
create trigger tasks_notify after insert or update of owner_member_id, done_at on public.tasks
  for each row execute function public.notify_task();

-- ---------------------------------------------------------------------------
-- Erasing a customer removes the notices that name them or quote their chats
-- ---------------------------------------------------------------------------

create function public.forget_erased_notices() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.notifications where contact_id = new.id;
  return new;
end $$;
create trigger contacts_forget_notices after update of erased_at on public.contacts
  for each row when (new.erased_at is not null and old.erased_at is null)
  execute function public.forget_erased_notices();

-- ---------------------------------------------------------------------------
-- What people can do (read state), and the periodic sweep
-- ---------------------------------------------------------------------------

-- Marks the caller's own notices read: the ones given, or all of them.
create function public.mark_notifications_read(p_workspace uuid, p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare
  me uuid := public.member_id(p_workspace);
  n int;
begin
  if me is null then raise exception 'not a member' using errcode = '42501'; end if;
  update public.notifications set read_at = now()
   where member_id = me and read_at is null and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

-- Run by the worker every few minutes: a notice for each open task that has passed its time (a task with only a day
-- is late once the day is over), once per due time so a snoozed task can be late again, and old notices are dropped.
create function public.sweep_notifications() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  insert into public.notifications (workspace_id, member_id, kind, subject, contact_id, deal_id, task_id, dedupe_key)
  select t.workspace_id, t.owner_member_id, 'task_late', left(t.text, 200), t.contact_id, t.deal_id, t.id, 'late:' || t.id || ':' || extract(epoch from t.due_at)::bigint
    from public.tasks t
    join public.members m on m.id = t.owner_member_id and m.status = 'active'
   where t.done_at is null and t.due_at is not null
     and case when t.has_time then t.due_at < now() else t.due_at + interval '1 day' < now() end
     and t.due_at > now() - interval '30 days'
  on conflict (member_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics n = row_count;
  delete from public.notifications where created_at < now() - interval '30 days';
  return n;
end $$;

revoke execute on function public.member_scope(uuid, text), public.member_in_scope(uuid, text, uuid, uuid),
  public.member_covers_conversation(uuid, uuid, text), public.sweep_notifications(),
  public.notify(uuid, uuid, text, uuid, text, text, numeric, uuid, uuid, uuid, uuid, uuid, text),
  public.mark_notifications_read(uuid, uuid[])
  from public, anon, authenticated;
grant execute on function public.mark_notifications_read(uuid, uuid[]) to authenticated;
grant execute on function public.sweep_notifications() to service_role;
