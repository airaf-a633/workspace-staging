-- Step 2c (finish): exporting customer data (owners and admins: contacts.erase).
-- One call returns everything held about each person, ready to hand over as an access request, or as a list.

create function public.export_contacts(p_contacts uuid[])
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
revoke all on function public.export_contacts(uuid[]) from public, anon;
grant execute on function public.export_contacts(uuid[]) to authenticated;
