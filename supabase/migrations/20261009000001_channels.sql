-- Relay omnichannel foundation (decided 2026-10-09): every connection is a row in "channels". WhatsApp keeps its
-- own detail table, which shares the channel's id. A contact has many identities (WhatsApp number, email, handle),
-- so one customer is one card across channels. Conversations belong to a channel; chat channels keep one thread per
-- customer, email threads by its own key. Messages use provider-neutral names (external_id, sent_at).

-- ---------------------------------------------------------------------------
-- Channels
-- ---------------------------------------------------------------------------

create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  type text not null check (type in ('whatsapp', 'webchat', 'email', 'instagram', 'messenger', 'telegram', 'sms', 'voice', 'tiktok',
                                     'x', 'line', 'viber', 'wechat', 'discord', 'slack', 'teams', 'apple', 'api')),
  name text not null check (length(name) between 1 and 80),
  -- The provider's id for this connection (WhatsApp phone_number_id, an inbound email address, a page id…).
  external_id text,
  team_id uuid references public.teams (id) on delete set null,
  status text not null default 'connected' check (status in ('connecting', 'connected', 'disconnected')),
  settings jsonb not null default '{}',
  connected_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  unique (type, external_id)
);
create trigger channels_touch before update on public.channels for each row execute function public.touch_updated_at();

-- Existing numbers become WhatsApp channels with the same id.
insert into public.channels (id, workspace_id, type, name, external_id, team_id, status, connected_by, created_at, updated_at)
select id, workspace_id, 'whatsapp', coalesce(verified_name, display_phone), phone_number_id, team_id, status, connected_by, created_at, updated_at
from public.whatsapp_accounts;

alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_channel_fk foreign key (workspace_id, id) references public.channels (workspace_id, id) on delete cascade,
  drop column team_id,
  drop column status;

alter table public.channels enable row level security;
create policy channels_read on public.channels for select to authenticated using ((select public.is_member(workspace_id)));
revoke all on public.channels from anon;
revoke insert, update, delete, truncate on public.channels from authenticated;

-- ---------------------------------------------------------------------------
-- Contact identities
-- ---------------------------------------------------------------------------

create table public.contact_identities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  -- whatsapp/sms/voice: digits without "+"; email: lower-case address; others: the provider's user id.
  kind text not null check (kind in ('whatsapp', 'phone', 'email', 'instagram', 'messenger', 'telegram', 'tiktok', 'x', 'line', 'viber',
                                     'wechat', 'discord', 'slack', 'teams', 'apple', 'webchat', 'api')),
  address text not null check (length(address) between 1 and 320),
  display text,                                          -- the handle or name as the provider shows it
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, address),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete cascade
);
create index contact_identities_contact_idx on public.contact_identities (contact_id);

insert into public.contact_identities (workspace_id, contact_id, kind, address)
select workspace_id, id, 'whatsapp', wa_id from public.contacts where wa_id is not null;

alter table public.contacts drop constraint contacts_created_from_check;
update public.contacts set created_from = 'channel' where created_from = 'whatsapp';
alter table public.contacts
  drop column wa_id,
  add column email text,
  add column phone text,
  alter column created_from set default 'channel',
  add constraint contacts_created_from_check check (created_from in ('channel', 'import', 'manual'));

alter table public.contact_identities enable row level security;
-- Same rule as the contact itself.
create policy contact_identities_read on public.contact_identities for select to authenticated
  using (exists (select 1 from public.contacts c where c.id = contact_identities.contact_id));
revoke all on public.contact_identities from anon;
revoke insert, update, delete, truncate on public.contact_identities from authenticated;

-- ---------------------------------------------------------------------------
-- Conversations and messages: provider-neutral
-- ---------------------------------------------------------------------------

alter table public.conversations drop constraint conversations_whatsapp_account_id_contact_id_key;
alter table public.conversations drop constraint conversations_workspace_id_whatsapp_account_id_fkey;
alter table public.conversations rename column whatsapp_account_id to channel_id;
alter table public.conversations
  add column thread_key text not null default '',   -- '' for chat channels; the root Message-ID for email
  add column subject text,
  add constraint conversations_channel_fk foreign key (workspace_id, channel_id) references public.channels (workspace_id, id) on delete cascade,
  add constraint conversations_thread_key unique (channel_id, contact_id, thread_key);

alter table public.messages rename column wamid to external_id;
alter table public.messages rename column reply_to_wamid to reply_to_external_id;
alter table public.messages rename column meta_timestamp to sent_at;
alter table public.messages rename constraint messages_workspace_id_wamid_key to messages_workspace_id_external_id_key;

-- ---------------------------------------------------------------------------
-- Functions, rewritten for channels
-- ---------------------------------------------------------------------------

drop function public.ingest_inbound_message(uuid, text, text, text, text, text, text, jsonb, text, timestamptz, boolean);
drop function public.apply_reaction(uuid, text, text);
drop function public.apply_message_status(uuid, text, text, text, text);
drop function public.update_whatsapp_account_state(text, text, text, text);

create or replace function public.connect_whatsapp_account(
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
    update public.channels set name = coalesce(p_verified_name, p_display_phone), status = 'connected' where id = existing.id;
    update public.whatsapp_accounts
       set waba_id = p_waba_id, display_phone = p_display_phone, verified_name = p_verified_name, quality_rating = p_quality,
           token_secret_id = secret, is_test = p_is_test
     where id = existing.id
    returning id into account;
    delete from vault.secrets where id = existing.token_secret_id;
  else
    select id into default_team from public.teams where workspace_id = p_workspace and is_default;
    insert into public.channels (workspace_id, type, name, external_id, team_id, connected_by)
    values (p_workspace, 'whatsapp', coalesce(p_verified_name, p_display_phone), p_phone_number_id, default_team, public.member_id(p_workspace))
    returning id into account;
    insert into public.whatsapp_accounts (id, workspace_id, waba_id, phone_number_id, display_phone, verified_name, quality_rating,
                                          token_secret_id, is_test, connected_by)
    values (account, p_workspace, p_waba_id, p_phone_number_id, p_display_phone, p_verified_name, p_quality, secret, p_is_test,
            public.member_id(p_workspace));
  end if;

  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, public.member_id(p_workspace), 'connect', 'channels', account::text,
          jsonb_build_object('type', 'whatsapp', 'phone_number_id', p_phone_number_id, 'display_phone', p_display_phone, 'is_test', p_is_test));
  return account;
end $$;

-- Stores one inbound message on any channel. Idempotent: a repeated external_id returns null and changes nothing.
-- The sender is found (or created) by identity. Reopen rule: a resolved chat reopens to its previous holder
-- within 7 days, else to the team queue.
create function public.ingest_inbound(
  p_channel uuid, p_kind text, p_address text, p_display text, p_external_id text, p_type text, p_body text, p_caption text,
  p_data jsonb, p_reply_to text, p_sent_at timestamptz, p_thread_key text default '', p_subject text default null,
  p_imported boolean default false
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  ch public.channels%rowtype;
  contact uuid;
  conv public.conversations%rowtype;
  msg uuid;
  default_team uuid;
begin
  select * into ch from public.channels where id = p_channel;
  if not found then raise exception 'unknown channel %', p_channel; end if;

  if exists (select 1 from public.messages where workspace_id = ch.workspace_id and external_id = p_external_id) then
    return null;
  end if;

  select contact_id into contact from public.contact_identities
   where workspace_id = ch.workspace_id and kind = p_kind and address = p_address;
  if contact is null then
    insert into public.contacts (workspace_id, profile_name, email, phone)
    values (ch.workspace_id, nullif(p_display, ''),
            case when p_kind = 'email' then p_address end,
            case when p_kind in ('whatsapp', 'phone') then '+' || p_address end)
    returning id into contact;
    insert into public.contact_identities (workspace_id, contact_id, kind, address, display)
    values (ch.workspace_id, contact, p_kind, p_address, nullif(p_display, ''));
  elsif nullif(p_display, '') is not null then
    update public.contacts set profile_name = p_display where id = contact and profile_name is distinct from p_display;
  end if;

  select * into conv from public.conversations
   where channel_id = ch.id and contact_id = contact and thread_key = coalesce(p_thread_key, '') for update;
  if not found then
    select id into default_team from public.teams where workspace_id = ch.workspace_id and is_default;
    insert into public.conversations (workspace_id, contact_id, channel_id, thread_key, subject, team_id, status, imported, resolved_at)
    values (ch.workspace_id, contact, ch.id, coalesce(p_thread_key, ''), p_subject, coalesce(ch.team_id, default_team),
            case when p_imported then 'resolved' else 'open' end, p_imported, case when p_imported then now() end)
    returning * into conv;
  end if;

  insert into public.messages (workspace_id, conversation_id, external_id, direction, source, type, body, caption, data,
                               reply_to_external_id, sent_at, imported)
  values (ch.workspace_id, conv.id, p_external_id, 'in', 'customer', p_type, p_body, p_caption, coalesce(p_data, '{}'), p_reply_to,
          p_sent_at, p_imported)
  returning id into msg;

  if not p_imported then
    update public.conversations
       set last_customer_message_at = greatest(last_customer_message_at, p_sent_at),
           last_message_at = greatest(last_message_at, p_sent_at),
           unread_count = unread_count + 1,
           status = case when status = 'resolved' then 'open' else status end,
           holder_member_id = case
             when status = 'resolved' and (resolved_at is null or resolved_at < now() - interval '7 days') then null
             else holder_member_id end,
           resolved_at = case when status = 'resolved' then null else resolved_at end
     where id = conv.id;
  else
    update public.conversations set last_message_at = greatest(last_message_at, p_sent_at) where id = conv.id;
  end if;
  return msg;
end $$;

-- A customer's reaction attaches to the message it reacts to (an empty emoji removes it).
create function public.apply_reaction(p_channel uuid, p_target text, p_emoji text)
returns boolean language sql security definer set search_path = '' as $$
  with updated as (
    update public.messages m set reaction = nullif(p_emoji, '')
    from public.channels c
    where c.id = p_channel and m.workspace_id = c.workspace_id and m.external_id = p_target
    returning m.id
  ) select exists (select 1 from updated)
$$;

-- Delivery statuses only move forward: a late "delivered" never overwrites "read". "failed" always wins.
create function public.apply_message_status(p_channel uuid, p_external_id text, p_status text, p_error_code text default null, p_error_text text default null)
returns boolean language sql security definer set search_path = '' as $$
  with ranked as (select array['queued', 'sent', 'delivered', 'read'] as ord),
  updated as (
    update public.messages m
       set status = p_status,
           error_code = coalesce(p_error_code, m.error_code),
           error_text = coalesce(p_error_text, m.error_text)
      from public.channels c, ranked r
     where c.id = p_channel and m.workspace_id = c.workspace_id and m.external_id = p_external_id
       and (p_status = 'failed'
            or (m.status is distinct from 'failed'
                and coalesce(array_position(r.ord, p_status), 0) > coalesce(array_position(r.ord, m.status), 0)))
    returning m.id
  ) select exists (select 1 from updated)
$$;

-- Account and quality webhooks.
create function public.update_whatsapp_account_state(p_phone_number_id text, p_status text default null, p_quality text default null, p_limit text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  account uuid;
begin
  update public.whatsapp_accounts
     set quality_rating = coalesce(p_quality, quality_rating), messaging_limit = coalesce(p_limit, messaging_limit)
   where phone_number_id = p_phone_number_id
  returning id into account;
  if account is not null and p_status is not null then
    update public.channels set status = p_status where id = account;
  end if;
  return account;
end $$;

revoke execute on function public.ingest_inbound(uuid, text, text, text, text, text, text, text, jsonb, text, timestamptz, text, text, boolean),
  public.apply_reaction(uuid, text, text), public.apply_message_status(uuid, text, text, text, text),
  public.update_whatsapp_account_state(text, text, text, text)
  from public, anon, authenticated;
