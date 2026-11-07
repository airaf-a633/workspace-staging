-- Discord (decided 2026-11-02): the customer's own Discord bot. Discord delivers messages only over a long-lived
-- Gateway connection, so one always-on process (apps/worker "gateway") holds a connection per connected bot and
-- queues each relevant message like a webhook. These functions are that process's only way in.

-- What the connection is doing, for the channel page: { state, detail, at }.
alter table public.channels add column health jsonb;

-- Discord allows 2,000 characters in a message.
create or replace function public.channel_max_length(p_type text) returns int language sql immutable as $$
  select case p_type when 'sms' then 1600 when 'line' then 5000 when 'slack' then 4000 when 'discord' then 2000 else 4096 end
$$;

-- Gateway process only. Which bots should be online right now?
create function public.discord_gateway_channels() returns table (id uuid)
language sql stable security definer set search_path = '' as $$
  select c.id from public.channels c where c.type = 'discord' and c.status = 'connected'
$$;

-- Gateway process only. Records what the connection is doing and what Discord told us about the bot (its user id and
-- application id, which the invite link needs). Settings are merged; the credentials and webhook key are never touched.
create function public.update_channel_runtime(p_channel uuid, p_state text, p_detail text, p_settings jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  update public.channels
     set health = jsonb_build_object('state', p_state, 'detail', p_detail, 'at', now()),
         settings = settings || (coalesce(p_settings, '{}') - 'webhook_key')
   where id = p_channel
$$;

revoke all on function public.discord_gateway_channels(), public.update_channel_runtime(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.discord_gateway_channels(), public.update_channel_runtime(uuid, text, text, jsonb) to service_role;
