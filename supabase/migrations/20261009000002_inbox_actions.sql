-- Backend step 2a (decided 2026-10-09): what people do to a conversation. Claim, hand over, resolve, reopen,
-- spam, internal notes with @mentions, asking to collaborate, and labels. Every write goes through a checked
-- function. Taking a chat someone else holds needs conversations.override. Handover, spam and override also go
-- to the audit log; the conversation's own event trail records everything.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.conversation_collaborators (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null,
  member_id uuid not null references public.members (id) on delete cascade,
  added_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (conversation_id, member_id),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade
);

-- The trail shown in the thread ("Leo claimed this", "Maya handed this to Sales").
create table public.conversation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null,
  kind text not null check (kind in ('claimed', 'handed_to_person', 'handed_to_team', 'resolved', 'reopened', 'spam', 'not_spam', 'asked_collab')),
  actor_member_id uuid references public.members (id) on delete set null,
  to_member_id uuid references public.members (id) on delete set null,
  to_team_id uuid references public.teams (id) on delete set null,
  -- Who held it at the time (for "asked to collaborate" and overrides).
  holder_member_id uuid references public.members (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade
);
create index conversation_events_thread_idx on public.conversation_events (conversation_id, created_at);

create table public.conversation_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null,
  author_member_id uuid references public.members (id) on delete set null,
  body text not null check (length(btrim(body)) between 1 and 5000),
  -- Members mentioned with @name; notifications read this later.
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade
);
create index conversation_notes_thread_idx on public.conversation_notes (conversation_id, created_at);

create table public.labels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  color text not null default '#56616A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  unique (workspace_id, name),
  unique (workspace_id, id)
);

create table public.conversation_labels (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null,
  label_id uuid not null,
  primary key (conversation_id, label_id),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, label_id) references public.labels (workspace_id, id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- Visibility: collaborators count as "own"
-- ---------------------------------------------------------------------------

create function public.is_collaborator(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversation_collaborators cc
    join public.members m on m.id = cc.member_id
    where cc.conversation_id = p_conversation and m.user_id = auth.uid()
  )
$$;

-- Does the caller's scope for this permission reach this conversation? Mirrors covers() in packages/domain.
create function public.covers_conversation(p_conversation uuid, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case public.permission_scope(c.workspace_id, p_permission)
      when 'all' then true
      when 'team' then c.holder_member_id = public.member_id(c.workspace_id) or public.is_collaborator(c.id)
                       or (c.team_id is not null and public.in_team(c.workspace_id, c.team_id))
      when 'own' then c.holder_member_id = public.member_id(c.workspace_id) or public.is_collaborator(c.id)
      else false
    end
    from public.conversations c where c.id = p_conversation
  ), false)
$$;

create or replace function public.conversation_visible(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.covers_conversation(p_conversation, 'conversations.view')
$$;

drop policy conversations_read on public.conversations;
create policy conversations_read on public.conversations for select to authenticated
  using (public.can_view_conversation(workspace_id, team_id, holder_member_id) or public.is_collaborator(id));

alter table public.conversation_collaborators enable row level security;
alter table public.conversation_events enable row level security;
alter table public.conversation_notes enable row level security;
alter table public.labels enable row level security;
alter table public.conversation_labels enable row level security;

create policy conversation_collaborators_read on public.conversation_collaborators for select to authenticated
  using (public.conversation_visible(conversation_id));
create policy conversation_events_read on public.conversation_events for select to authenticated
  using (public.conversation_visible(conversation_id));
create policy conversation_notes_read on public.conversation_notes for select to authenticated
  using (public.conversation_visible(conversation_id));
create policy labels_read on public.labels for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy conversation_labels_read on public.conversation_labels for select to authenticated
  using (public.conversation_visible(conversation_id));

revoke all on public.conversation_collaborators, public.conversation_events, public.conversation_notes, public.labels, public.conversation_labels from anon;
revoke insert, update, delete, truncate on public.conversation_collaborators, public.conversation_events, public.conversation_notes,
  public.labels, public.conversation_labels from authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conversation_events, public.conversation_notes;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

-- Locks the conversation and checks the caller can see it. Raises if not.
create function public.lock_visible_conversation(p_conversation uuid)
returns public.conversations language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype;
begin
  select * into conv from public.conversations where id = p_conversation for update;
  if not found or not public.conversation_visible(p_conversation) then
    raise exception 'conversation not found' using errcode = 'P0002';
  end if;
  return conv;
end $$;

-- Claim an unheld chat, or take over a held one (needs conversations.override; audited).
create function public.claim_conversation(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  me uuid := public.member_id(conv.workspace_id);
begin
  if conv.holder_member_id = me then return; end if;
  if conv.holder_member_id is null then
    if not public.covers_conversation(conv.id, 'conversations.claim') then
      raise exception 'you cannot claim this conversation' using errcode = '42501';
    end if;
  else
    if not public.covers_conversation(conv.id, 'conversations.override') then
      raise exception 'someone else holds this conversation' using errcode = '42501';
    end if;
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (conv.workspace_id, me, 'override', 'conversations', conv.id::text, jsonb_build_object('previous_holder', conv.holder_member_id));
  end if;
  update public.conversations set holder_member_id = me, status = case when status = 'spam' then status else 'open' end, resolved_at = null
   where id = conv.id;
  delete from public.conversation_collaborators where conversation_id = conv.id and member_id = me;
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, holder_member_id)
  values (conv.workspace_id, conv.id, 'claimed', me, conv.holder_member_id);
end $$;

-- Hand over to a person or a team, with a note so the next person knows what to do. Clears collaborators.
create function public.hand_over_conversation(p_conversation uuid, p_to_member uuid, p_to_team uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  me uuid := public.member_id(conv.workspace_id);
begin
  if not public.covers_conversation(conv.id, 'conversations.handover') then
    raise exception 'you cannot hand over this conversation' using errcode = '42501';
  end if;
  if conv.holder_member_id is not null and conv.holder_member_id <> me and not public.covers_conversation(conv.id, 'conversations.override') then
    raise exception 'someone else holds this conversation' using errcode = '42501';
  end if;
  if (p_to_member is null) = (p_to_team is null) then
    raise exception 'hand over to one person or one team' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_note, ''))) < 10 then
    raise exception 'handoff note too short' using errcode = '22023';
  end if;
  if p_to_member is not null and not exists (
    select 1 from public.members where id = p_to_member and workspace_id = conv.workspace_id and status = 'active') then
    raise exception 'unknown member' using errcode = '22023';
  end if;
  if p_to_team is not null and not exists (select 1 from public.teams where id = p_to_team and workspace_id = conv.workspace_id) then
    raise exception 'unknown team' using errcode = '22023';
  end if;

  update public.conversations
     set holder_member_id = p_to_member, team_id = coalesce(p_to_team, team_id),
         status = case when status = 'spam' then status else 'open' end, resolved_at = null
   where id = conv.id;
  delete from public.conversation_collaborators where conversation_id = conv.id;
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, to_member_id, to_team_id, holder_member_id, note)
  values (conv.workspace_id, conv.id, case when p_to_member is not null then 'handed_to_person' else 'handed_to_team' end,
          me, p_to_member, p_to_team, conv.holder_member_id, btrim(p_note));
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (conv.workspace_id, me, 'handover', 'conversations', conv.id::text,
          jsonb_build_object('from', conv.holder_member_id, 'to_member', p_to_member, 'to_team', p_to_team));
end $$;

-- resolved / open (reopen) / spam / not_spam.
create function public.set_conversation_status(p_conversation uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  me uuid := public.member_id(conv.workspace_id);
  perm text := case when p_action in ('spam', 'not_spam') then 'conversations.spam' else 'conversations.resolve' end;
begin
  if p_action not in ('resolved', 'reopened', 'spam', 'not_spam') then
    raise exception 'unknown action %', p_action using errcode = '22023';
  end if;
  if not public.covers_conversation(conv.id, perm) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.conversations
     set status = case p_action when 'resolved' then 'resolved' when 'spam' then 'spam' else 'open' end,
         resolved_at = case when p_action = 'resolved' then now() end,
         unread_count = case when p_action in ('resolved', 'spam') then 0 else unread_count end
   where id = conv.id;
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id)
  values (conv.workspace_id, conv.id, p_action, me);
  if p_action in ('spam', 'not_spam') then
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (conv.workspace_id, me, p_action, 'conversations', conv.id::text, '{}');
  end if;
end $$;

-- An internal note; mentions must be active members of the workspace.
create function public.add_conversation_note(p_conversation uuid, p_body text, p_mentions uuid[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  note uuid;
  valid uuid[];
begin
  if not public.covers_conversation(conv.id, 'conversations.notes') then
    raise exception 'you cannot write notes here' using errcode = '42501';
  end if;
  select coalesce(array_agg(id), '{}') into valid from public.members
   where workspace_id = conv.workspace_id and status = 'active' and id = any (coalesce(p_mentions, '{}'));
  insert into public.conversation_notes (workspace_id, conversation_id, author_member_id, body, mentions)
  values (conv.workspace_id, conv.id, public.member_id(conv.workspace_id), btrim(p_body), valid)
  returning id into note;
  return note;
end $$;

-- A follower asks the holder to be added (the holder decides; notifications come later).
create function public.ask_to_collaborate(p_conversation uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
begin
  if conv.holder_member_id is null then
    raise exception 'nobody holds this conversation' using errcode = '22023';
  end if;
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, holder_member_id)
  values (conv.workspace_id, conv.id, 'asked_collab', public.member_id(conv.workspace_id), conv.holder_member_id);
end $$;

revoke execute on function public.is_collaborator(uuid), public.covers_conversation(uuid, text), public.lock_visible_conversation(uuid),
  public.claim_conversation(uuid), public.hand_over_conversation(uuid, uuid, uuid, text), public.set_conversation_status(uuid, text),
  public.add_conversation_note(uuid, text, uuid[]), public.ask_to_collaborate(uuid)
  from public, anon;
revoke execute on function public.lock_visible_conversation(uuid) from authenticated;
grant execute on function public.is_collaborator(uuid), public.covers_conversation(uuid, text),
  public.claim_conversation(uuid), public.hand_over_conversation(uuid, uuid, uuid, text), public.set_conversation_status(uuid, text),
  public.add_conversation_note(uuid, text, uuid[]), public.ask_to_collaborate(uuid)
  to authenticated;
