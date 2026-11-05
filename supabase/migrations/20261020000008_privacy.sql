-- Step 2c (decided 2026-10-20): marketing consent and do-not-contact, merging duplicates, erasing a person's data,
-- and spreadsheet import.
--   * Consent is kept per customer and channel (in / out), with where it came from and who set it. "Unknown" is
--     the absence of a row. Do-not-contact overrides everything.
--   * Merging moves everything from the duplicate onto the customer you keep; chats on the same channel join up.
--   * Erasing removes personal data (details, ways to reach them, message text, notes, files) but keeps an
--     anonymous "Erased customer" so reports still count that chats happened. Owners and admins only.
--   * Import fills in blanks on matching customers (same email or phone) and never overwrites; consent from a
--     file is honoured only when its column says yes.

-- ---------------------------------------------------------------------------
-- Consent and do-not-contact
-- ---------------------------------------------------------------------------

create table public.contact_consent (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contact_id uuid not null,
  channel text not null check (channel in ('whatsapp', 'email', 'sms', 'instagram', 'messenger', 'telegram', 'tiktok', 'line', 'viber', 'wechat')),
  status text not null check (status in ('in', 'out')),
  source text not null check (length(source) between 1 and 80),
  set_by uuid references public.members (id) on delete set null,
  set_at timestamptz not null default now(),
  primary key (contact_id, channel),
  foreign key (workspace_id, contact_id) references public.contacts (workspace_id, id) on delete cascade
);
alter table public.contact_consent enable row level security;
create policy contact_consent_read on public.contact_consent for select to authenticated using (public.contact_visible(contact_id));
revoke all on public.contact_consent from anon;
revoke insert, update, delete, truncate on public.contact_consent from authenticated;

alter table public.contacts
  add column do_not_contact boolean not null default false,
  add column erased_at timestamptz;

-- p_status: in / out / unknown (unknown removes the record).
create function public.set_consent(p_contact uuid, p_channel text, p_status text, p_source text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.contacts where id = p_contact;
  if ws is null or not public.can_edit_contact(p_contact) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_status = 'unknown' then
    delete from public.contact_consent where contact_id = p_contact and channel = p_channel;
  else
    insert into public.contact_consent (workspace_id, contact_id, channel, status, source, set_by)
    values (ws, p_contact, p_channel, p_status, coalesce(nullif(btrim(p_source), ''), 'Changed by the team'), public.member_id(ws))
    on conflict (contact_id, channel) do update set status = excluded.status, source = excluded.source, set_by = excluded.set_by, set_at = now();
  end if;
  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (ws, public.member_id(ws), 'consent', 'contacts', p_contact::text, jsonb_build_object('channel', p_channel, 'status', p_status));
end $$;

create function public.set_do_not_contact(p_contact uuid, p_on boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_edit_contact(p_contact) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.contacts set do_not_contact = p_on where id = p_contact;
end $$;

-- ---------------------------------------------------------------------------
-- Merging (contacts.merge)
-- ---------------------------------------------------------------------------

-- Moves one conversation's history into another (same channel, same thread), then removes the empty one.
create function public.join_conversations(p_into uuid, p_from uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.messages set conversation_id = p_into where conversation_id = p_from;
  update public.conversation_events set conversation_id = p_into where conversation_id = p_from;
  update public.conversation_notes set conversation_id = p_into where conversation_id = p_from;
  insert into public.conversation_collaborators (workspace_id, conversation_id, member_id, added_by, created_at)
    select workspace_id, p_into, member_id, added_by, created_at from public.conversation_collaborators where conversation_id = p_from
    on conflict do nothing;
  insert into public.conversation_labels (workspace_id, conversation_id, label_id)
    select workspace_id, p_into, label_id from public.conversation_labels where conversation_id = p_from
    on conflict do nothing;
  update public.conversations k set
    last_message_at = greatest(k.last_message_at, f.last_message_at),
    last_customer_message_at = greatest(k.last_customer_message_at, f.last_customer_message_at),
    unread_count = k.unread_count + f.unread_count,
    status = case when 'open' in (k.status, f.status) then 'open' else k.status end
  from public.conversations f where k.id = p_into and f.id = p_from;
  delete from public.conversations where id = p_from;
end $$;

-- p_take: which of the duplicate's values replace the kept customer's (keys: name, email, phone, company, owner,
-- lifecycle, language, area). Everything else is combined: identities, chats, tags, fields, consent.
create function public.merge_contacts(p_keep uuid, p_drop uuid, p_take text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
declare
  k public.contacts%rowtype;
  d public.contacts%rowtype;
  dc public.conversations%rowtype;
  twin uuid;
begin
  select * into k from public.contacts where id = p_keep for update;
  select * into d from public.contacts where id = p_drop for update;
  if k.id is null or d.id is null or k.workspace_id <> d.workspace_id or k.id = d.id then raise exception 'not_found' using errcode = 'P0002'; end if;
  if public.permission_scope(k.workspace_id, 'contacts.merge') = 'none' or not public.contact_visible(k.id) or not public.contact_visible(d.id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;

  -- Chats: a duplicate's chat on a channel where the kept customer already has the same thread joins it.
  for dc in select * from public.conversations where contact_id = d.id loop
    select id into twin from public.conversations where contact_id = k.id and channel_id = dc.channel_id and thread_key = dc.thread_key;
    if twin is not null then perform public.join_conversations(twin, dc.id);
    else update public.conversations set contact_id = k.id where id = dc.id;
    end if;
  end loop;

  update public.contact_identities set contact_id = k.id where contact_id = d.id;
  insert into public.contact_consent (workspace_id, contact_id, channel, status, source, set_by, set_at)
    select workspace_id, k.id, channel, status, source, set_by, set_at from public.contact_consent where contact_id = d.id
    on conflict (contact_id, channel) do nothing;

  update public.contacts set
    name = case when 'name' = any (p_take) then d.name else coalesce(k.name, d.name) end,
    profile_name = coalesce(k.profile_name, d.profile_name),
    email = case when 'email' = any (p_take) then d.email else coalesce(k.email, d.email) end,
    phone = case when 'phone' = any (p_take) then d.phone else coalesce(k.phone, d.phone) end,
    company_id = case when 'company' = any (p_take) then d.company_id else coalesce(k.company_id, d.company_id) end,
    owner_member_id = case when 'owner' = any (p_take) then d.owner_member_id else coalesce(k.owner_member_id, d.owner_member_id) end,
    lifecycle = case when 'lifecycle' = any (p_take) then d.lifecycle else k.lifecycle end,
    language = case when 'language' = any (p_take) then d.language else coalesce(k.language, d.language) end,
    area = case when 'area' = any (p_take) then d.area else coalesce(k.area, d.area) end,
    tags = array(select distinct unnest(k.tags || d.tags)),
    fields = d.fields || k.fields,
    pinned_note = coalesce(k.pinned_note, d.pinned_note),
    pinned_by = case when k.pinned_note is null then d.pinned_by else k.pinned_by end,
    pinned_at = case when k.pinned_note is null then d.pinned_at else k.pinned_at end,
    do_not_contact = k.do_not_contact or d.do_not_contact
  where id = k.id;
  delete from public.contacts where id = d.id;

  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (k.workspace_id, public.member_id(k.workspace_id), 'merge', 'contacts', k.id::text, jsonb_build_object('merged', d.id, 'took', p_take));
end $$;

-- ---------------------------------------------------------------------------
-- Erasing (contacts.erase: owners and admins)
-- ---------------------------------------------------------------------------

-- Removes the personal data of each customer and returns how many were erased. Stored files are deleted by the
-- worker (an erase_media job), because only the service role may remove them.
create function public.erase_contacts(p_contacts uuid[])
returns int language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts%rowtype;
  n int := 0;
  paths text[];
begin
  for c in select * from public.contacts where id = any (p_contacts) and erased_at is null for update loop
    if public.permission_scope(c.workspace_id, 'contacts.erase') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;

    select coalesce(array_agg(md.storage_path) filter (where md.storage_path is not null), '{}') into paths
      from public.media md join public.messages m on m.media_id = md.id join public.conversations v on v.id = m.conversation_id
     where v.contact_id = c.id;
    -- Email attachments beyond the first are listed on the message.
    paths := paths || coalesce((select array_agg(a ->> 'path') from public.messages m join public.conversations v on v.id = m.conversation_id,
                                  jsonb_array_elements(coalesce(m.data -> 'attachments', '[]')) a where v.contact_id = c.id), '{}');

    delete from public.media md using public.messages m, public.conversations v
     where m.media_id = md.id and v.id = m.conversation_id and v.contact_id = c.id;
    update public.messages m set body = null, caption = null, data = '{}', media_id = null, reaction = null, error_text = null
      from public.conversations v where v.id = m.conversation_id and v.contact_id = c.id;
    delete from public.conversation_notes n using public.conversations v where v.id = n.conversation_id and v.contact_id = c.id;
    update public.conversations set subject = null where contact_id = c.id;
    delete from public.contact_identities where contact_id = c.id;
    delete from public.contact_consent where contact_id = c.id;
    update public.contacts set
      name = 'Erased customer', profile_name = null, email = null, phone = null, tags = '{}', fields = '{}', language = null, area = null,
      company_id = null, pinned_note = null, pinned_by = null, pinned_at = null, do_not_contact = true, erased_at = now()
    where id = c.id;

    if cardinality(paths) > 0 then perform public.enqueue_job('erase_media', jsonb_build_object('paths', to_jsonb(paths))); end if;
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (c.workspace_id, public.member_id(c.workspace_id), 'erase', 'contacts', c.id::text, jsonb_build_object('files', cardinality(paths)));
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Import (contacts.edit)
-- ---------------------------------------------------------------------------

-- p_rows: [{id?, name, email, phone, company, tags[], lifecycle, language, area, fields{}, consent}] (up to 2,000 per call).
-- id ties a row to a customer the person chose on the review step.
-- Returns {created, updated, skipped}.
create function public.import_contacts(p_workspace uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r jsonb;
  v_email text;
  v_phone text;
  v_company uuid;
  existing uuid;
  created int := 0;
  updated int := 0;
  skipped int := 0;
  cid uuid;
  me uuid := public.member_id(p_workspace);
begin
  if public.permission_scope(p_workspace, 'contacts.edit') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_rows, '[]')) > 2000 then raise exception 'too_many' using errcode = '22023'; end if;

  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]')) loop
    v_email := lower(nullif(btrim(coalesce(r ->> 'email', '')), ''));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_email := null; end if;
    v_phone := nullif(regexp_replace(coalesce(r ->> 'phone', ''), '[^0-9]', '', 'g'), '');
    if v_phone is not null and length(v_phone) not between 6 and 16 then v_phone := null; end if;
    if v_email is null and v_phone is null then skipped := skipped + 1; continue; end if;

    v_company := null;
    if nullif(btrim(coalesce(r ->> 'company', '')), '') is not null then
      select id into v_company from public.companies where workspace_id = p_workspace and lower(name) = lower(btrim(r ->> 'company'));
      if v_company is null then
        insert into public.companies (workspace_id, name, owner_member_id) values (p_workspace, left(btrim(r ->> 'company'), 120), me) returning id into v_company;
      end if;
    end if;

    existing := null;
    -- A row the person tied to an existing customer on the review step ("same person").
    if (r ->> 'id') ~ '^[0-9a-f-]{36}$' then
      select id into existing from public.contacts where id = (r ->> 'id')::uuid and workspace_id = p_workspace and erased_at is null;
    end if;
    if existing is null then
      select contact_id into existing from public.contact_identities
       where workspace_id = p_workspace and ((kind = 'email' and address = v_email) or (kind in ('phone', 'whatsapp') and address = v_phone))
       limit 1;
    end if;

    if existing is not null then
      -- Fill in blanks only; never overwrite what's there. Tags are added.
      update public.contacts set
        name = coalesce(name, nullif(btrim(r ->> 'name'), '')),
        email = coalesce(email, v_email),
        phone = coalesce(phone, case when v_phone is not null then '+' || v_phone end),
        company_id = coalesce(company_id, v_company),
        language = coalesce(language, nullif(btrim(r ->> 'language'), '')),
        area = coalesce(area, nullif(btrim(r ->> 'area'), '')),
        tags = array(select distinct unnest(tags || coalesce(array(select left(btrim(t), 40) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t where btrim(t) <> ''), '{}'))),
        fields = coalesce((select jsonb_object_agg(e.key, left(e.value #>> '{}', 500)) from jsonb_each(coalesce(r -> 'fields', '{}')) e
                            join public.contact_field_defs fd on fd.workspace_id = p_workspace and fd.key = e.key
                           where nullif(btrim(e.value #>> '{}'), '') is not null), '{}') || fields
      where id = existing;
      cid := existing;
      updated := updated + 1;
    else
      insert into public.contacts (workspace_id, name, email, phone, company_id, language, area, lifecycle, tags, created_from, owner_member_id, fields)
      values (p_workspace, nullif(btrim(r ->> 'name'), ''), v_email, case when v_phone is not null then '+' || v_phone end, v_company,
              nullif(btrim(r ->> 'language'), ''), nullif(btrim(r ->> 'area'), ''),
              case when r ->> 'lifecycle' in ('lead', 'customer', 'repeat', 'churned') then r ->> 'lifecycle' else 'lead' end,
              coalesce(array(select distinct left(btrim(t), 40) from jsonb_array_elements_text(coalesce(r -> 'tags', '[]')) t where btrim(t) <> ''), '{}'),
              'import', me,
              coalesce((select jsonb_object_agg(e.key, left(e.value #>> '{}', 500)) from jsonb_each(coalesce(r -> 'fields', '{}')) e
                         join public.contact_field_defs fd on fd.workspace_id = p_workspace and fd.key = e.key
                        where nullif(btrim(e.value #>> '{}'), '') is not null), '{}'))
      returning id into cid;
      created := created + 1;
    end if;

    if v_email is not null then
      insert into public.contact_identities (workspace_id, contact_id, kind, address) values (p_workspace, cid, 'email', v_email) on conflict do nothing;
    end if;
    if v_phone is not null then
      insert into public.contact_identities (workspace_id, contact_id, kind, address) values (p_workspace, cid, 'phone', v_phone) on conflict do nothing;
    end if;

    -- Consent only when the file says yes, recorded as coming from the file. Existing consent is never changed.
    if lower(coalesce(r ->> 'consent', '')) in ('yes', 'y', 'true', '1', 'opted in', 'opt-in') then
      insert into public.contact_consent (workspace_id, contact_id, channel, status, source, set_by)
      select p_workspace, cid, ch, 'in', 'Imported file', me
        from unnest(array_remove(array[case when v_email is not null then 'email' end,
                                       case when v_phone is not null then 'whatsapp' end,
                                       case when v_phone is not null then 'sms' end], null)) ch
      on conflict (contact_id, channel) do nothing;
    end if;
  end loop;

  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (p_workspace, me, 'import', 'contacts', null, jsonb_build_object('created', created, 'updated', updated, 'skipped', skipped));
  return jsonb_build_object('created', created, 'updated', updated, 'skipped', skipped);
end $$;

revoke execute on function public.set_consent(uuid, text, text, text), public.set_do_not_contact(uuid, boolean),
  public.join_conversations(uuid, uuid), public.merge_contacts(uuid, uuid, text[]), public.erase_contacts(uuid[]), public.import_contacts(uuid, jsonb)
  from public, anon;
revoke execute on function public.join_conversations(uuid, uuid) from authenticated;
grant execute on function public.set_consent(uuid, text, text, text), public.set_do_not_contact(uuid, boolean),
  public.merge_contacts(uuid, uuid, text[]), public.erase_contacts(uuid[]), public.import_contacts(uuid, jsonb)
  to authenticated;
