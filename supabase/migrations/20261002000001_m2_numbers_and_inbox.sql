-- M2.2 WhatsApp numbers and M2.3 receiving: numbers (token in Vault), contacts, conversations,
-- messages and media. App users only read, through row-level security that follows their role
-- (conversations.view: all / team / own). Every write comes from the worker (service role) or
-- from a checked security-definer function. Decided 2026-10-02 (docs/milestones/M2-plan.md).

-- ---------------------------------------------------------------------------
-- Numbers
-- ---------------------------------------------------------------------------

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  waba_id text not null check (waba_id ~ '^[0-9]{5,25}$'),
  phone_number_id text not null unique check (phone_number_id ~ '^[0-9]{5,25}$'),
  display_phone text not null,
  verified_name text,
  team_id uuid references public.teams (id) on delete set null,
  -- Vault secret holding the access token; never readable by app users (column grant below).
  token_secret_id uuid,
  is_test boolean not null default false,
  coexistence boolean not null default false,
  status text not null default 'connected' check (status in ('connecting', 'connected', 'disconnected')),
  quality_rating text,
  messaging_limit text,
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create trigger whatsapp_accounts_touch before update on public.whatsapp_accounts for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Contacts, conversations, media, messages
-- ---------------------------------------------------------------------------

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  wa_id text check (wa_id ~ '^[0-9]{6,20}$'),           -- WhatsApp ID: the number in digits, no "+"
  profile_name text,                                    -- as set on the customer's phone
  name text,                                            -- set by staff; shown instead of profile_name
  locale text,
  created_from text not null default 'whatsapp' check (created_from in ('whatsapp', 'import', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, wa_id),
  unique (workspace_id, id)
);
create trigger contacts_touch before update on public.contacts for each row execute function public.touch_updated_at();

-- One thread per customer per number; its status moves between open, resolved and spam.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  whatsapp_account_id uuid not null,
  team_id uuid references public.teams (id) on delete set null,
  holder_member_id uuid references public.members (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'resolved', 'spam')),
  unread_count int not null default 0 check (unread_count >= 0),
  last_customer_message_at timestamptz,
  last_message_at timestamptz,
  resolved_at timestamptz,
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  unique (whatsapp_account_id, contact_id),
  unique (workspace_id, id),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete cascade,
  foreign key (workspace_id, whatsapp_account_id) references public.whatsapp_accounts (workspace_id, id) on delete cascade
);
create index conversations_list_idx on public.conversations (workspace_id, status, last_message_at desc);

create table public.media (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  meta_media_id text,
  storage_path text,                                    -- {workspace}/{conversation}/{id}.{ext} in the private "media" bucket
  mime text,
  size bigint,
  sha256 text,
  filename text,
  downloaded_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  conversation_id uuid not null,
  wamid text,                                           -- WhatsApp message ID: the dedupe key
  direction text not null check (direction in ('in', 'out')),
  source text not null default 'customer' check (source in ('customer', 'inbox', 'phone_app', 'system', 'ai')),
  type text not null,                                   -- text, image, audio, video, document, sticker, location, contacts, interactive, button, unsupported…
  body text,
  caption text,
  media_id uuid,
  data jsonb not null default '{}',                     -- location, shared contacts, etc.
  reply_to_wamid text,
  reaction text,                                        -- the customer's reaction to this message
  status text check (status in ('queued', 'sent', 'delivered', 'read', 'failed')),
  error_code text,
  error_text text,
  sent_by_member uuid,
  meta_timestamp timestamptz not null,
  imported boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, wamid),
  foreign key (workspace_id, conversation_id) references public.conversations (workspace_id, id) on delete cascade,
  foreign key (workspace_id, media_id) references public.media (workspace_id, id) on delete set null (media_id)
);
create index messages_thread_idx on public.messages (conversation_id, meta_timestamp);

-- ---------------------------------------------------------------------------
-- Who may see a conversation (conversations.view: all / team / own)
-- ---------------------------------------------------------------------------

create function public.can_view_conversation(p_workspace uuid, p_team uuid, p_holder uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select case public.permission_scope(p_workspace, 'conversations.view')
    when 'all' then true
    when 'team' then (p_team is not null and public.in_team(p_workspace, p_team)) or p_holder = public.member_id(p_workspace)
    when 'own' then p_holder = public.member_id(p_workspace)
    else false
  end
$$;

create function public.conversation_visible(p_conversation uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.conversations c
    where c.id = p_conversation and public.can_view_conversation(c.workspace_id, c.team_id, c.holder_member_id)
  )
$$;

alter table public.whatsapp_accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.conversations enable row level security;
alter table public.media enable row level security;
alter table public.messages enable row level security;

create policy whatsapp_accounts_read on public.whatsapp_accounts for select to authenticated
  using ((select public.is_member(workspace_id)));
create policy conversations_read on public.conversations for select to authenticated
  using (public.can_view_conversation(workspace_id, team_id, holder_member_id));
create policy messages_read on public.messages for select to authenticated
  using (public.conversation_visible(conversation_id));
create policy media_read on public.media for select to authenticated
  using (exists (select 1 from public.messages m where m.media_id = media.id and public.conversation_visible(m.conversation_id)));
-- Contacts: everyone with contacts.view "all"; the viewer role ("team") sees contacts of conversations it can see.
create policy contacts_read on public.contacts for select to authenticated
  using (
    public.permission_scope(workspace_id, 'contacts.view') = 'all'
    or (public.has_permission(workspace_id, 'contacts.view')
        and exists (select 1 from public.conversations c where c.contact_id = contacts.id and public.can_view_conversation(c.workspace_id, c.team_id, c.holder_member_id)))
  );

-- Reads only. Writes go through the worker or checked functions; the token column is never readable.
revoke all on public.whatsapp_accounts, public.contacts, public.conversations, public.media, public.messages from anon;
revoke insert, update, delete, truncate on public.whatsapp_accounts, public.contacts, public.conversations, public.media, public.messages from authenticated;
revoke select on public.whatsapp_accounts from authenticated;
grant select (id, workspace_id, waba_id, phone_number_id, display_phone, verified_name, team_id, is_test, coexistence, status,
              quality_rating, messaging_limit, created_at, updated_at) on public.whatsapp_accounts to authenticated;

-- ---------------------------------------------------------------------------
-- Connecting a number (the owner's test-number form; Embedded Signup replaces it in M2.8)
-- ---------------------------------------------------------------------------

create function public.connect_whatsapp_account(
  p_workspace uuid, p_waba_id text, p_phone_number_id text, p_display_phone text,
  p_verified_name text, p_quality text, p_token text, p_is_test boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  existing public.whatsapp_accounts%rowtype;
  secret uuid;
  account uuid;
  default_team uuid;
begin
  if not public.has_permission(p_workspace, 'numbers.manage') then
    raise exception 'only the owner can connect numbers' using errcode = '42501';
  end if;
  if coalesce(length(p_token), 0) < 20 then
    raise exception 'access token missing' using errcode = '22023';
  end if;
  select * into existing from public.whatsapp_accounts where phone_number_id = p_phone_number_id;
  if found and existing.workspace_id <> p_workspace then
    raise exception 'number already connected elsewhere' using errcode = '23505';
  end if;

  secret := vault.create_secret(p_token, 'wa_token_' || p_phone_number_id || '_' || extract(epoch from now())::bigint, 'WhatsApp access token');
  if found then
    update public.whatsapp_accounts
       set waba_id = p_waba_id, display_phone = p_display_phone, verified_name = p_verified_name, quality_rating = p_quality,
           token_secret_id = secret, status = 'connected', is_test = p_is_test
     where id = existing.id
    returning id into account;
    delete from vault.secrets where id = existing.token_secret_id;
  else
    select id into default_team from public.teams where workspace_id = p_workspace and is_default;
    insert into public.whatsapp_accounts (workspace_id, waba_id, phone_number_id, display_phone, verified_name, quality_rating,
                                          token_secret_id, is_test, team_id, connected_by)
    values (p_workspace, p_waba_id, p_phone_number_id, p_display_phone, p_verified_name, p_quality, secret, p_is_test,
            default_team, public.member_id(p_workspace))
    returning id into account;
  end if;

  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'connect', 'whatsapp_accounts', account::text,
          jsonb_build_object('phone_number_id', p_phone_number_id, 'display_phone', p_display_phone, 'is_test', p_is_test));
  return account;
end $$;

-- The worker's way to the token (service role only).
create function public.whatsapp_token(p_account uuid)
returns text language sql stable security definer set search_path = '' as $$
  select s.decrypted_secret from public.whatsapp_accounts a
  join vault.decrypted_secrets s on s.id = a.token_secret_id
  where a.id = p_account
$$;

-- ---------------------------------------------------------------------------
-- Receiving (called by the worker for each inbound message)
-- ---------------------------------------------------------------------------

-- Stores one inbound message. Idempotent: a repeated wamid returns null and changes nothing.
-- Reopen rule: a resolved chat reopens to its previous holder within 7 days, else to the team queue.
create function public.ingest_inbound_message(
  p_account uuid, p_wa_id text, p_profile_name text, p_wamid text, p_type text, p_body text, p_caption text,
  p_data jsonb, p_reply_to text, p_meta_ts timestamptz, p_imported boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  acc public.whatsapp_accounts%rowtype;
  contact uuid;
  conv public.conversations%rowtype;
  msg uuid;
  default_team uuid;
begin
  select * into acc from public.whatsapp_accounts where id = p_account;
  if not found then raise exception 'unknown account %', p_account; end if;

  if exists (select 1 from public.messages where workspace_id = acc.workspace_id and wamid = p_wamid) then
    return null;
  end if;

  insert into public.contacts (workspace_id, wa_id, profile_name)
  values (acc.workspace_id, p_wa_id, nullif(p_profile_name, ''))
  on conflict (workspace_id, wa_id) do update
    set profile_name = coalesce(excluded.profile_name, public.contacts.profile_name)
  returning id into contact;

  select * into conv from public.conversations where whatsapp_account_id = acc.id and contact_id = contact for update;
  if not found then
    select id into default_team from public.teams where workspace_id = acc.workspace_id and is_default;
    insert into public.conversations (workspace_id, contact_id, whatsapp_account_id, team_id, status, imported, resolved_at)
    values (acc.workspace_id, contact, acc.id, coalesce(acc.team_id, default_team),
            case when p_imported then 'resolved' else 'open' end, p_imported, case when p_imported then now() end)
    returning * into conv;
  end if;

  insert into public.messages (workspace_id, conversation_id, wamid, direction, source, type, body, caption, data, reply_to_wamid,
                               meta_timestamp, imported)
  values (acc.workspace_id, conv.id, p_wamid, 'in', 'customer', p_type, p_body, p_caption, coalesce(p_data, '{}'), p_reply_to,
          p_meta_ts, p_imported)
  returning id into msg;

  if not p_imported then
    update public.conversations
       set last_customer_message_at = greatest(last_customer_message_at, p_meta_ts),
           last_message_at = greatest(last_message_at, p_meta_ts),
           unread_count = unread_count + 1,
           status = case when status = 'resolved' then 'open' else status end,
           holder_member_id = case
             when status = 'resolved' and (resolved_at is null or resolved_at < now() - interval '7 days') then null
             else holder_member_id end,
           resolved_at = case when status = 'resolved' then null else resolved_at end
     where id = conv.id;
  else
    update public.conversations set last_message_at = greatest(last_message_at, p_meta_ts) where id = conv.id;
  end if;
  return msg;
end $$;

-- A customer's reaction attaches to the message it reacts to (an empty emoji removes it).
create function public.apply_reaction(p_account uuid, p_target_wamid text, p_emoji text)
returns boolean language sql security definer set search_path = '' as $$
  with updated as (
    update public.messages m set reaction = nullif(p_emoji, '')
    from public.whatsapp_accounts a
    where a.id = p_account and m.workspace_id = a.workspace_id and m.wamid = p_target_wamid
    returning m.id
  ) select exists (select 1 from updated)
$$;

-- Delivery statuses only move forward: a late "delivered" never overwrites "read". "failed" always wins.
create function public.apply_message_status(p_account uuid, p_wamid text, p_status text, p_error_code text default null, p_error_text text default null)
returns boolean language sql security definer set search_path = '' as $$
  with ranked as (select array['queued', 'sent', 'delivered', 'read'] as ord),
  updated as (
    update public.messages m
       set status = p_status,
           error_code = coalesce(p_error_code, m.error_code),
           error_text = coalesce(p_error_text, m.error_text)
      from public.whatsapp_accounts a, ranked r
     where a.id = p_account and m.workspace_id = a.workspace_id and m.wamid = p_wamid
       and (p_status = 'failed'
            or (m.status is distinct from 'failed'
                and coalesce(array_position(r.ord, p_status), 0) > coalesce(array_position(r.ord, m.status), 0)))
    returning m.id
  ) select exists (select 1 from updated)
$$;

-- Account and quality webhooks.
create function public.update_whatsapp_account_state(p_phone_number_id text, p_status text default null, p_quality text default null, p_limit text default null)
returns uuid language sql security definer set search_path = '' as $$
  update public.whatsapp_accounts
     set status = coalesce(p_status, status), quality_rating = coalesce(p_quality, quality_rating), messaging_limit = coalesce(p_limit, messaging_limit)
   where phone_number_id = p_phone_number_id
  returning id
$$;

-- Media rows created by the worker after downloading; attached to their message.
create function public.attach_media(p_message uuid, p_meta_media_id text, p_storage_path text, p_mime text, p_size bigint, p_sha256 text, p_filename text, p_error text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
  media_row uuid;
begin
  select workspace_id into ws from public.messages where id = p_message;
  if ws is null then raise exception 'unknown message %', p_message; end if;
  insert into public.media (workspace_id, meta_media_id, storage_path, mime, size, sha256, filename, downloaded_at, error)
  values (ws, p_meta_media_id, p_storage_path, p_mime, p_size, p_sha256, p_filename, case when p_error is null then now() end, p_error)
  returning id into media_row;
  update public.messages set media_id = media_row where id = p_message;
  return media_row;
end $$;

-- Opening a chat clears its unread count (only for people who can see it).
create function public.mark_conversation_read(p_conversation uuid)
returns void language sql security definer set search_path = '' as $$
  update public.conversations set unread_count = 0
   where id = p_conversation and public.can_view_conversation(workspace_id, team_id, holder_member_id)
$$;

revoke execute on function public.connect_whatsapp_account(uuid, text, text, text, text, text, text, boolean),
  public.whatsapp_token(uuid), public.ingest_inbound_message(uuid, text, text, text, text, text, text, jsonb, text, timestamptz, boolean),
  public.apply_reaction(uuid, text, text), public.apply_message_status(uuid, text, text, text, text),
  public.update_whatsapp_account_state(text, text, text, text),
  public.attach_media(uuid, text, text, text, bigint, text, text, text),
  public.mark_conversation_read(uuid), public.can_view_conversation(uuid, uuid, uuid), public.conversation_visible(uuid)
  from public, anon;
-- Worker-only functions.
revoke execute on function public.whatsapp_token(uuid), public.ingest_inbound_message(uuid, text, text, text, text, text, text, jsonb, text, timestamptz, boolean),
  public.apply_reaction(uuid, text, text), public.apply_message_status(uuid, text, text, text, text),
  public.update_whatsapp_account_state(text, text, text, text), public.attach_media(uuid, text, text, text, bigint, text, text, text)
  from authenticated;
grant execute on function public.connect_whatsapp_account(uuid, text, text, text, text, text, text, boolean),
  public.mark_conversation_read(uuid), public.can_view_conversation(uuid, uuid, uuid), public.conversation_visible(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Live updates and private media storage (skipped where Supabase's schemas don't exist, e.g. PGlite tests)
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.conversations, public.messages;
  end if;
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict (id) do nothing;
    -- Path: {workspace}/{conversation}/{file}. Readable only by people who can see that conversation.
    execute $p$
      create policy media_objects_read on storage.objects for select to authenticated
      using (bucket_id = 'media' and public.conversation_visible((storage.foldername(name))[2]::uuid))
    $p$;
  end if;
end $$;
