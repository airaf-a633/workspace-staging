-- Backend step 2b (decided 2026-10-20): customers and companies on real data, custom fields, and saving the inbox's
-- labels and helpers. Editing rule: anyone who can see a customer can edit them, except Viewers, so the Agent
-- role's "edit contacts" widens from their own to all they can see.

-- ---------------------------------------------------------------------------
-- Editing rights: Agents edit any customer they can see
-- ---------------------------------------------------------------------------

update public.role_template_permissions set scope = 'all' where template_key = 'agent' and permission = 'contacts.edit';
update public.role_permissions rp set scope = 'all'
  from public.roles r
 where r.id = rp.role_id and r.template_key = 'agent' and rp.permission = 'contacts.edit';

-- ---------------------------------------------------------------------------
-- Companies, custom fields, and the new customer details
-- ---------------------------------------------------------------------------

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  domain text check (domain is null or domain ~ '^[a-z0-9.-]+\.[a-z]{2,}$'),
  industry text,
  size text,
  location text,
  owner_member_id uuid references public.members (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);
create unique index companies_domain_idx on public.companies (workspace_id, domain) where domain is not null;
create trigger companies_touch before update on public.companies for each row execute function public.touch_updated_at();

-- Fields a business adds for every customer (Settings › Contacts).
create table public.contact_field_defs (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$'),
  label text not null check (length(btrim(label)) between 1 and 60),
  type text not null check (type in ('text', 'number', 'date', 'select')),
  options text[] not null default '{}',
  position int not null default 0,
  primary key (workspace_id, key)
);

alter table public.contacts
  add column lifecycle text not null default 'lead' check (lifecycle in ('lead', 'customer', 'repeat', 'churned')),
  add column owner_member_id uuid references public.members (id) on delete set null,
  add column company_id uuid,
  add column tags text[] not null default '{}',
  add column language text,
  add column area text,
  add column fields jsonb not null default '{}',
  add column pinned_note text check (pinned_note is null or length(pinned_note) <= 1000),
  add column pinned_by uuid references public.members (id) on delete set null,
  add column pinned_at timestamptz,
  add constraint contacts_company_fk foreign key (workspace_id, company_id) references public.companies (workspace_id, id) on delete set null (company_id);
create index contacts_company_idx on public.contacts (company_id) where company_id is not null;
create index contacts_tags_idx on public.contacts using gin (tags);

alter table public.companies enable row level security;
alter table public.contact_field_defs enable row level security;
create policy companies_read on public.companies for select to authenticated using ((select public.is_member(workspace_id)));
create policy contact_field_defs_read on public.contact_field_defs for select to authenticated using ((select public.is_member(workspace_id)));
revoke all on public.companies, public.contact_field_defs from anon;
revoke insert, update, delete, truncate on public.companies, public.contact_field_defs from authenticated;

-- The handover trail learns about helpers.
alter table public.conversation_events drop constraint conversation_events_kind_check;
alter table public.conversation_events add constraint conversation_events_kind_check
  check (kind in ('claimed', 'handed_to_person', 'handed_to_team', 'resolved', 'reopened', 'spam', 'not_spam', 'asked_collab',
                  'collab_added', 'collab_removed', 'collab_declined'));

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

-- Can the caller see this customer? Same rule as the contacts_read policy (below): every contact, or the ones in
-- conversations they can see, plus manual contacts they own.
create function public.contact_visible(p_contact uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.contacts c
    where c.id = p_contact
      and (public.permission_scope(c.workspace_id, 'contacts.view') = 'all'
           or (public.has_permission(c.workspace_id, 'contacts.view')
               and (c.owner_member_id = public.member_id(c.workspace_id)
                    or exists (select 1 from public.conversations v where v.contact_id = c.id
                                 and public.can_view_conversation(v.workspace_id, v.team_id, v.holder_member_id)))))
  )
$$;

-- Anyone who can see a customer edits them, if their role may edit contacts at all (Viewers can't).
create function public.can_edit_contact(p_contact uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((
    select public.permission_scope(c.workspace_id, 'contacts.edit') <> 'none' and public.contact_visible(c.id)
    from public.contacts c where c.id = p_contact
  ), false)
$$;

-- Changes the fields present in p_patch; anything absent stays. Keys: name, email, phone, lifecycle, owner,
-- company, tags, language, area, fields.
create function public.update_contact(p_contact uuid, p_patch jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts%rowtype;
  v_email text;
  v_phone text;
begin
  select * into c from public.contacts where id = p_contact for update;
  if not found or not public.can_edit_contact(p_contact) then raise exception 'not_allowed' using errcode = '42501'; end if;

  if p_patch ? 'name' and length(btrim(coalesce(p_patch ->> 'name', ''))) > 120 then raise exception 'too_long' using errcode = '22023'; end if;
  if p_patch ? 'email' then
    v_email := lower(nullif(btrim(coalesce(p_patch ->> 'email', '')), ''));
    if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'bad_email' using errcode = '22023'; end if;
  end if;
  if p_patch ? 'phone' then
    v_phone := nullif(regexp_replace(coalesce(p_patch ->> 'phone', ''), '[^0-9+]', '', 'g'), '');
    if v_phone is not null and v_phone !~ '^\+?[0-9]{6,16}$' then raise exception 'bad_phone' using errcode = '22023'; end if;
  end if;
  if p_patch ? 'owner' and p_patch ->> 'owner' is not null and not exists (
    select 1 from public.members where id = (p_patch ->> 'owner')::uuid and workspace_id = c.workspace_id and status = 'active') then
    raise exception 'bad_owner' using errcode = '22023';
  end if;
  if p_patch ? 'company' and p_patch ->> 'company' is not null and not exists (
    select 1 from public.companies where id = (p_patch ->> 'company')::uuid and workspace_id = c.workspace_id) then
    raise exception 'bad_company' using errcode = '22023';
  end if;

  update public.contacts set
    name = case when p_patch ? 'name' then nullif(btrim(p_patch ->> 'name'), '') else name end,
    email = case when p_patch ? 'email' then v_email else email end,
    phone = case when p_patch ? 'phone' then v_phone else phone end,
    lifecycle = case when p_patch ? 'lifecycle' then p_patch ->> 'lifecycle' else lifecycle end,
    owner_member_id = case when p_patch ? 'owner' then (p_patch ->> 'owner')::uuid else owner_member_id end,
    company_id = case when p_patch ? 'company' then (p_patch ->> 'company')::uuid else company_id end,
    tags = case when p_patch ? 'tags' then
             (select coalesce(array_agg(distinct left(btrim(t), 40)) filter (where btrim(t) <> ''), '{}')
                from jsonb_array_elements_text(p_patch -> 'tags') t)
           else tags end,
    language = case when p_patch ? 'language' then nullif(btrim(p_patch ->> 'language'), '') else language end,
    area = case when p_patch ? 'area' then nullif(btrim(p_patch ->> 'area'), '') else area end,
    -- Only fields the business defined are kept; empty values are removed.
    fields = case when p_patch ? 'fields' then
               coalesce((select jsonb_object_agg(e.key, left(e.value #>> '{}', 500))
                           from jsonb_each(p_patch -> 'fields') e
                           join public.contact_field_defs d on d.workspace_id = c.workspace_id and d.key = e.key
                          where nullif(btrim(e.value #>> '{}'), '') is not null), '{}')
             else fields end
  where id = c.id;

  -- A new email or phone is also a way to reach them (never taken from another customer).
  if v_email is not null then
    insert into public.contact_identities (workspace_id, contact_id, kind, address) values (c.workspace_id, c.id, 'email', v_email)
    on conflict (workspace_id, kind, address) do nothing;
  end if;
  if v_phone is not null then
    insert into public.contact_identities (workspace_id, contact_id, kind, address) values (c.workspace_id, c.id, 'phone', ltrim(v_phone, '+'))
    on conflict (workspace_id, kind, address) do nothing;
  end if;
end $$;

-- A customer added by hand (the Contacts list's Add button).
create function public.create_contact(p_workspace uuid, p_name text, p_email text, p_phone text, p_company uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  c uuid;
begin
  if public.permission_scope(p_workspace, 'contacts.edit') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 120 then raise exception 'need_name' using errcode = '22023'; end if;
  if nullif(btrim(coalesce(p_email, '')), '') is null and nullif(btrim(coalesce(p_phone, '')), '') is null then
    raise exception 'need_reach' using errcode = '22023';
  end if;
  insert into public.contacts (workspace_id, name, created_from, owner_member_id) values (p_workspace, btrim(p_name), 'manual', public.member_id(p_workspace))
  returning id into c;
  -- Manual contacts are owned by whoever added them, so an Agent can see them straight away.
  perform public.update_contact(c, jsonb_strip_nulls(jsonb_build_object('email', p_email, 'phone', p_phone, 'company', p_company)));
  return c;
end $$;

create function public.pin_contact_note(p_contact uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts%rowtype;
begin
  select * into c from public.contacts where id = p_contact;
  if not found or not public.can_edit_contact(p_contact) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update public.contacts
     set pinned_note = nullif(btrim(coalesce(p_text, '')), ''),
         pinned_by = case when nullif(btrim(coalesce(p_text, '')), '') is null then null else public.member_id(c.workspace_id) end,
         pinned_at = case when nullif(btrim(coalesce(p_text, '')), '') is null then null else now() end
   where id = c.id;
end $$;

-- Manual contacts are visible to their owner even before any conversation exists.
drop policy contacts_read on public.contacts;
create policy contacts_read on public.contacts for select to authenticated
  using (
    public.permission_scope(workspace_id, 'contacts.view') = 'all'
    or (public.has_permission(workspace_id, 'contacts.view')
        and (owner_member_id = public.member_id(workspace_id)
             or exists (select 1 from public.conversations c where c.contact_id = contacts.id and public.can_view_conversation(c.workspace_id, c.team_id, c.holder_member_id))))
  );

-- ---------------------------------------------------------------------------
-- Companies
-- ---------------------------------------------------------------------------

create function public.save_company(p_workspace uuid, p_company uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  id uuid := p_company;
  v_domain text := lower(nullif(regexp_replace(btrim(coalesce(p_data ->> 'domain', '')), '^(https?://)?(www\.)?([^/]+).*$', '\3'), ''));
begin
  if public.permission_scope(p_workspace, 'contacts.edit') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_data ->> 'name', ''))) not between 1 and 120 then raise exception 'need_name' using errcode = '22023'; end if;
  if v_domain is not null and v_domain !~ '^[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'bad_domain' using errcode = '22023'; end if;
  if p_company is null then
    insert into public.companies (workspace_id, name, domain, industry, size, location, owner_member_id)
    values (p_workspace, btrim(p_data ->> 'name'), v_domain, nullif(btrim(p_data ->> 'industry'), ''), nullif(btrim(p_data ->> 'size'), ''),
            nullif(btrim(p_data ->> 'location'), ''), public.member_id(p_workspace))
    returning companies.id into id;
  else
    update public.companies
       set name = btrim(p_data ->> 'name'), domain = v_domain, industry = nullif(btrim(p_data ->> 'industry'), ''),
           size = nullif(btrim(p_data ->> 'size'), ''), location = nullif(btrim(p_data ->> 'location'), '')
     where companies.id = p_company and workspace_id = p_workspace;
    if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  end if;
  return id;
exception when unique_violation then
  raise exception 'domain_taken' using errcode = '23505';
end $$;

-- ---------------------------------------------------------------------------
-- Custom fields (owners and admins: crm.settings)
-- ---------------------------------------------------------------------------

-- Replaces the whole list: [{key, label, type, options}] in display order. Removing a field keeps old values hidden.
create function public.save_contact_fields(p_workspace uuid, p_defs jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if public.permission_scope(p_workspace, 'crm.settings') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if jsonb_array_length(coalesce(p_defs, '[]')) > 30 then raise exception 'too_many' using errcode = '22023'; end if;
  delete from public.contact_field_defs where workspace_id = p_workspace;
  insert into public.contact_field_defs (workspace_id, key, label, type, options, position)
  select p_workspace, d ->> 'key', btrim(d ->> 'label'), d ->> 'type',
         coalesce(array(select left(btrim(o), 60) from jsonb_array_elements_text(coalesce(d -> 'options', '[]')) o where btrim(o) <> ''), '{}'),
         (n - 1)::int
  from jsonb_array_elements(coalesce(p_defs, '[]')) with ordinality as x(d, n);
end $$;

-- ---------------------------------------------------------------------------
-- Labels and helpers, saved for real
-- ---------------------------------------------------------------------------

create function public.save_label(p_workspace uuid, p_label uuid, p_name text, p_color text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  id uuid := p_label;
begin
  if public.permission_scope(p_workspace, 'crm.settings') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_name, ''))) not between 1 and 40 then raise exception 'need_name' using errcode = '22023'; end if;
  if p_label is null then
    insert into public.labels (workspace_id, name, color) values (p_workspace, btrim(p_name), coalesce(p_color, '#56616A')) returning labels.id into id;
  else
    update public.labels set name = btrim(p_name), color = coalesce(p_color, color) where labels.id = p_label and workspace_id = p_workspace;
  end if;
  return id;
exception when unique_violation then
  raise exception 'name_taken' using errcode = '23505';
end $$;

create function public.delete_label(p_label uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  ws uuid;
begin
  select workspace_id into ws from public.labels where id = p_label;
  if ws is null or public.permission_scope(ws, 'crm.settings') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.labels where id = p_label;
end $$;

-- Labeling a chat follows conversations.notes (anyone who can write notes on it).
create function public.set_conversation_labels(p_conversation uuid, p_labels uuid[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
begin
  if not public.covers_conversation(conv.id, 'conversations.notes') then raise exception 'not_allowed' using errcode = '42501'; end if;
  delete from public.conversation_labels where conversation_id = conv.id;
  insert into public.conversation_labels (workspace_id, conversation_id, label_id)
  select conv.workspace_id, conv.id, l.id from public.labels l where l.workspace_id = conv.workspace_id and l.id = any (coalesce(p_labels, '{}'));
end $$;

-- p_action: add / remove / decline. Adding needs conversations.collaborators and a teammate who can reply.
create function public.set_collaborator(p_conversation uuid, p_member uuid, p_action text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  conv public.conversations%rowtype := public.lock_visible_conversation(p_conversation);
  me uuid := public.member_id(conv.workspace_id);
begin
  if p_action not in ('add', 'remove', 'decline') then raise exception 'bad_action' using errcode = '22023'; end if;
  if not (public.covers_conversation(conv.id, 'conversations.collaborators') or conv.holder_member_id = me) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_action = 'add' then
    if not exists (
      select 1 from public.members m join public.role_permissions rp on rp.role_id = m.role_id
      where m.id = p_member and m.workspace_id = conv.workspace_id and m.status = 'active'
        and rp.permission = 'conversations.reply' and rp.scope <> 'none') then
      raise exception 'cannot_reply' using errcode = '22023';
    end if;
    insert into public.conversation_collaborators (workspace_id, conversation_id, member_id, added_by)
    values (conv.workspace_id, conv.id, p_member, me) on conflict do nothing;
  elsif p_action = 'remove' then
    delete from public.conversation_collaborators where conversation_id = conv.id and member_id = p_member;
  end if;
  insert into public.conversation_events (workspace_id, conversation_id, kind, actor_member_id, to_member_id)
  values (conv.workspace_id, conv.id, 'collab_' || case p_action when 'add' then 'added' when 'remove' then 'removed' else 'declined' end, me, p_member);
end $$;

revoke execute on function public.contact_visible(uuid), public.can_edit_contact(uuid), public.update_contact(uuid, jsonb),
  public.create_contact(uuid, text, text, text, uuid), public.pin_contact_note(uuid, text), public.save_company(uuid, uuid, jsonb),
  public.save_contact_fields(uuid, jsonb), public.save_label(uuid, uuid, text, text), public.delete_label(uuid),
  public.set_conversation_labels(uuid, uuid[]), public.set_collaborator(uuid, uuid, text)
  from public, anon;
grant execute on function public.contact_visible(uuid), public.can_edit_contact(uuid), public.update_contact(uuid, jsonb),
  public.create_contact(uuid, text, text, text, uuid), public.pin_contact_note(uuid, text), public.save_company(uuid, uuid, jsonb),
  public.save_contact_fields(uuid, jsonb), public.save_label(uuid, uuid, text, text), public.delete_label(uuid),
  public.set_conversation_labels(uuid, uuid[]), public.set_collaborator(uuid, uuid, text)
  to authenticated;
