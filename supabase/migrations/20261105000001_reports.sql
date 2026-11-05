-- Reports on real data (decided 2026-11-05): conversations, team and sales. Two functions that answer in one call, so the
-- screen never loads chats or messages. Both check reports.view first: "all" sees everything, "team" only chats (and deals) of
-- the teams the caller belongs to or holds themselves. Nothing here is stored; every answer is worked out from the chats,
-- messages, trail and deals that already exist.
--
-- What is counted (decided with the founder):
--   A chat is a stretch of conversation: a customer's message that comes first, or after the conversation was resolved, starts
--   one; it ends when someone resolves it. Writing again after a resolve starts a new chat.
--   First reply = the first message a person sent in the chat (from the inbox, or from the business's phone app); automatic,
--   AI and failed messages don't count. Reported as the median, in clock time (working hours aren't built yet).
--   Resolution = start to the resolve. Chats brought in by "import history" and spam are left out.
--   Times of day and days use the workspace's time zone. A chat belongs to the day it started and to the team it is in now.

create function public.report_conversations(p_workspace uuid, p_days int, p_tz text, p_team uuid default null, p_channel text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope public.permission_scope := public.permission_scope(p_workspace, 'reports.view');
  me uuid := public.member_id(p_workspace);
  mine uuid[];
  today date;
  win_from timestamptz;
  prev_from timestamptz;
  result jsonb;
begin
  if scope = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_days not in (7, 30, 90) then raise exception 'bad_range' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then raise exception 'bad_zone' using errcode = '22023'; end if;
  select coalesce(array_agg(tm.team_id), '{}') into mine
    from public.team_members tm join public.members m on m.id = tm.member_id
   where tm.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  today := (now() at time zone p_tz)::date;
  win_from := (today - (p_days - 1))::timestamp at time zone p_tz;
  prev_from := (today - (2 * p_days - 1))::timestamp at time zone p_tz;

  with convs as (
    select c.id, c.team_id, ch.type as channel
      from public.conversations c join public.channels ch on ch.id = c.channel_id
     where c.workspace_id = p_workspace and not c.imported and c.status <> 'spam'
       and (scope = 'all' or c.team_id = any (mine) or c.holder_member_id = me)
       and (p_team is null or c.team_id = p_team)
       and (p_channel is null or ch.type = p_channel)
  ),
  ins as (
    select m.conversation_id, m.sent_at,
           lag(m.sent_at) over (partition by m.conversation_id order by m.sent_at) as prev_in
      from public.messages m join convs v on v.id = m.conversation_id
     where m.direction = 'in' and not m.imported
  ),
  flagged as (
    select i.conversation_id, i.sent_at,
           (i.prev_in is null or exists (
              select 1 from public.conversation_events e
               where e.conversation_id = i.conversation_id and e.kind = 'resolved' and e.created_at > i.prev_in and e.created_at < i.sent_at)) as is_start
      from ins i
  ),
  starts as (
    select f.conversation_id, f.sent_at as started_at,
           lead(f.sent_at) over (partition by f.conversation_id order by f.sent_at) as next_start
      from flagged f where f.is_start
  ),
  chats as (
    select s.conversation_id, s.started_at, s.next_start, v.team_id, v.channel, r.at as resolved_at, r.who as resolved_by, fr.sent_at as reply_at, fr.who as reply_by
      from starts s
      join convs v on v.id = s.conversation_id
      left join lateral (
        select e.created_at as at, e.actor_member_id as who from public.conversation_events e
         where e.conversation_id = s.conversation_id and e.kind = 'resolved'
           and e.created_at > s.started_at and e.created_at < coalesce(s.next_start, 'infinity'::timestamptz)
         order by e.created_at limit 1) r on true
      left join lateral (
        select o.sent_at, o.sent_by_member as who from public.messages o
         where o.conversation_id = s.conversation_id and o.direction = 'out' and o.source in ('inbox', 'phone_app')
           and not o.imported and o.status is distinct from 'failed'
           and o.sent_at > s.started_at and o.sent_at < coalesce(r.at, s.next_start, 'infinity'::timestamptz)
         order by o.sent_at limit 1) fr on true
     where s.started_at >= prev_from
  ),
  cur as (select * from chats where started_at >= win_from),
  pairs as (
    select c.conversation_id, c.started_at, o.sent_by_member as member_id
      from cur c
      join public.messages o on o.conversation_id = c.conversation_id and o.direction = 'out' and o.source = 'inbox'
       and o.sent_by_member is not null and not o.imported and o.status is distinct from 'failed'
       and o.sent_at > c.started_at and o.sent_at < coalesce(c.resolved_at, c.next_start, 'infinity'::timestamptz)
     group by c.conversation_id, c.started_at, o.sent_by_member
  ),
  hand as (
    select e.actor_member_id as actor, e.to_member_id as to_member
      from public.conversation_events e join convs v on v.id = e.conversation_id
     where e.kind in ('handed_to_person', 'handed_to_team') and e.created_at >= win_from
  ),
  people as (
    select member_id from pairs
    union select reply_by from cur where reply_by is not null
    union select resolved_by from cur where resolved_by is not null
    union select actor from hand where actor is not null
    union select to_member from hand where to_member is not null
  )
  select jsonb_build_object(
    'total', (select count(*) from cur),
    'prevTotal', (select count(*) from chats where started_at < win_from),
    'firstReplySeconds', (select percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) from cur where reply_at is not null),
    'resolutionSeconds', (select percentile_cont(0.5) within group (order by extract(epoch from resolved_at - started_at)) from cur where resolved_at is not null),
    'resolved', (select count(*) from cur where resolved_at is not null),
    'backlog', (select count(*) from convs v join public.conversations c on c.id = v.id where c.status = 'open'),
    'days', (select coalesce(jsonb_agg(jsonb_build_object('day', (today - (p_days - 1) + i)::text, 'n', coalesce(x.n, 0)) order by i), '[]')
               from generate_series(0, p_days - 1) i
               left join (select (started_at at time zone p_tz)::date as day, count(*) as n from cur group by 1) x on x.day = today - (p_days - 1) + i),
    'byChannel', (select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'n', n, 'firstReplySeconds', fr, 'resolved', resolved) order by n desc), '[]')
                    from (select channel, count(*) as n,
                                 percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) filter (where reply_at is not null) as fr,
                                 count(*) filter (where resolved_at is not null) as resolved
                            from cur group by channel) x),
    'heat', (select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'block', block, 'n', n)), '[]')
               from (select extract(isodow from started_at at time zone p_tz)::int - 1 as dow, extract(hour from started_at at time zone p_tz)::int / 2 as block, count(*) as n
                       from cur group by 1, 2) h),
    'team', (select coalesce(jsonb_agg(jsonb_build_object(
                  'member', p.member_id,
                  'n', (select count(*) from pairs x where x.member_id = p.member_id),
                  'firstReplySeconds', (select percentile_cont(0.5) within group (order by extract(epoch from reply_at - started_at)) from cur where reply_by = p.member_id),
                  'resolved', (select count(*) from cur where resolved_by = p.member_id),
                  'handedOver', (select count(*) from hand where actor = p.member_id),
                  'received', (select count(*) from hand where to_member = p.member_id)
                ) order by (select count(*) from pairs x where x.member_id = p.member_id) desc), '[]')
               from people p)
  ) into result;
  return result;
end $$;

-- Pipeline now, and what was won and lost in the period. Only deals this person may see (deals.view) inside their reports
-- scope; amounts only for those who may see every deal value (deals.values all or team), otherwise just counts.
create function public.report_sales(p_workspace uuid, p_days int, p_tz text, p_team uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  scope public.permission_scope := public.permission_scope(p_workspace, 'reports.view');
  me uuid := public.member_id(p_workspace);
  money boolean := public.permission_scope(p_workspace, 'deals.values') in ('all', 'team');
  mine uuid[];
  win_from timestamptz;
  result jsonb;
begin
  if scope = 'none' then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_days not in (7, 30, 90) then raise exception 'bad_range' using errcode = '22023'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_tz) then raise exception 'bad_zone' using errcode = '22023'; end if;
  select coalesce(array_agg(tm.team_id), '{}') into mine
    from public.team_members tm join public.members m on m.id = tm.member_id
   where tm.workspace_id = p_workspace and m.user_id = auth.uid() and m.status = 'active';
  win_from := (((now() at time zone p_tz)::date - (p_days - 1))::timestamp) at time zone p_tz;

  with seen as (
    select d.id, d.status, d.closed_at, d.lost_reason, s.key as stage, v.value_minor
      from public.deals d
      join public.pipeline_stages s on s.id = d.stage_id
      left join public.deal_values v on v.deal_id = d.id
     where d.workspace_id = p_workspace
       and public.in_scope(p_workspace, 'deals.view', d.team_id, d.owner_member_id)
       and (scope = 'all' or d.team_id = any (mine) or d.owner_member_id = me)
       and (p_team is null or d.team_id = p_team)
  )
  select jsonb_build_object(
    'money', money,
    'stages', (select coalesce(jsonb_agg(jsonb_build_object('stage', stage, 'n', n, 'value', case when money then value end)), '[]')
                 from (select stage, count(*) as n, coalesce(sum(value_minor), 0) as value from seen where status = 'open' group by stage) x),
    'won', (select jsonb_build_object('n', count(*), 'value', case when money then coalesce(sum(value_minor), 0) end) from seen where status = 'won' and closed_at >= win_from),
    'lost', (select count(*) from seen where status = 'lost' and closed_at >= win_from),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('reason', lost_reason, 'n', n) order by n desc), '[]')
                  from (select lost_reason, count(*) as n from seen where status = 'lost' and closed_at >= win_from group by lost_reason) x)
  ) into result;
  return result;
end $$;

revoke execute on function public.report_conversations(uuid, int, text, uuid, text), public.report_sales(uuid, int, text, uuid) from public, anon;
grant execute on function public.report_conversations(uuid, int, text, uuid, text), public.report_sales(uuid, int, text, uuid) to authenticated;
