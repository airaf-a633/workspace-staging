-- Deals and tasks join the privacy tools (decided 2026-11-03).
--
-- Merging two customers moves their deals and tasks to the kept one (without this the duplicate's deals would be deleted with it).
-- Erasing a customer deletes their deals, with notes, values and history, and their tasks, as the privacy decisions say.
-- Exporting a customer includes their deals and tasks (owners and admins only, as before).

create or replace function public.merge_contacts(p_keep uuid, p_drop uuid, p_take text[] default '{}')
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
  -- Deals and tasks follow the customer they belonged to.
  update public.deals set contact_id = k.id where contact_id = d.id;
  update public.tasks set contact_id = k.id where contact_id = d.id;
  delete from public.contacts where id = d.id;

  insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
  values (k.workspace_id, public.member_id(k.workspace_id), 'merge', 'contacts', k.id::text, jsonb_build_object('merged', d.id, 'took', p_take));
end $$;

create or replace function public.erase_contacts(p_contacts uuid[])
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
    -- Their deals (with notes, values and history) and tasks are deleted, as the privacy decisions say.
    delete from public.deals where contact_id = c.id;
    delete from public.tasks where contact_id = c.id;
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

create or replace function public.export_contacts(p_contacts uuid[])
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  c public.contacts%rowtype;
  out jsonb := '[]';
  ws uuid;
begin
  if coalesce(array_length(p_contacts, 1), 0) = 0 then return out; end if;
  if array_length(p_contacts, 1) > 500 then raise exception 'too_long'; end if;
  for c in select * from public.contacts where id = any (p_contacts) and erased_at is null order by created_at loop
    if public.permission_scope(c.workspace_id, 'contacts.erase') = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
    ws := c.workspace_id;
    out := out || jsonb_build_array(jsonb_build_object(
      'id', c.id,
      'name', c.name, 'profile_name', c.profile_name, 'email', c.email, 'phone', c.phone,
      'lifecycle', c.lifecycle, 'language', c.language, 'area', c.area, 'tags', c.tags, 'fields', c.fields,
      'company', (select co.name from public.companies co where co.id = c.company_id),
      'do_not_contact', c.do_not_contact,
      'created_at', c.created_at,
      'identities', coalesce((select jsonb_agg(jsonb_build_object('kind', i.kind, 'address', i.address, 'display', i.display))
                                from public.contact_identities i where i.contact_id = c.id), '[]'),
      'consent', coalesce((select jsonb_agg(jsonb_build_object('channel', k.channel, 'status', k.status, 'source', k.source, 'set_at', k.set_at))
                             from public.contact_consent k where k.contact_id = c.id), '[]'),
      'deals', coalesce((select jsonb_agg(jsonb_build_object('title', dl.title, 'status', dl.status, 'stage', ps.key, 'lost_reason', dl.lost_reason,
                                   'created_at', dl.created_at, 'closed_at', dl.closed_at,
                                   'value_minor', (select dv.value_minor from public.deal_values dv where dv.deal_id = dl.id)) order by dl.created_at)
                           from public.deals dl join public.pipeline_stages ps on ps.id = dl.stage_id where dl.contact_id = c.id), '[]'),
      'tasks', coalesce((select jsonb_agg(jsonb_build_object('text', tk.text, 'due_at', tk.due_at, 'done_at', tk.done_at, 'repeat', tk.repeat) order by tk.created_at)
                           from public.tasks tk where tk.contact_id = c.id), '[]'),
      'conversations', coalesce((select jsonb_agg(jsonb_build_object(
          'channel', ch.type, 'subject', v.subject, 'started_at', v.created_at,
          'messages', coalesce((select jsonb_agg(jsonb_build_object('at', m.sent_at, 'direction', m.direction, 'type', m.type, 'text', coalesce(m.body, m.caption))
                                  order by m.sent_at)
                                  from public.messages m where m.conversation_id = v.id), '[]'),
          'notes', coalesce((select jsonb_agg(jsonb_build_object('at', n.created_at, 'text', n.body) order by n.created_at)
                               from public.conversation_notes n where n.conversation_id = v.id), '[]')
        ) order by v.created_at)
        from public.conversations v join public.channels ch on ch.id = v.channel_id where v.contact_id = c.id), '[]')
    ));
    insert into public.audit_log (workspace_id, actor_member_id, action, entity, entity_id, data)
    values (c.workspace_id, public.member_id(c.workspace_id), 'export', 'contacts', c.id::text, '{}');
  end loop;
  return out;
end $$;

grant execute on function public.merge_contacts(uuid, uuid, text[]), public.erase_contacts(uuid[]), public.export_contacts(uuid[]) to authenticated;
