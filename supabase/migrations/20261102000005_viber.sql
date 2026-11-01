-- Viber (decided 2026-11-02): a business that already has a Viber bot connects it with its token.
--
-- Viber's developer page allows text up to 7,000 characters. It does not describe a 24-hour rule that stops a bot
-- sending (only that messages inside a 24-hour session are not billed and ones outside it are), so Relay no longer
-- blocks replies after 24 hours: it would refuse messages Viber accepts. The screens say outside-session messages
-- may be charged by Viber instead.
create or replace function public.channel_max_length(p_type text) returns int language sql immutable as $$
  select case p_type when 'sms' then 1600 when 'line' then 5000 when 'slack' then 4000 when 'discord' then 2000 when 'viber' then 7000 else 4096 end
$$;

create or replace function public.channel_reply_window(p_type text) returns interval language sql immutable as $$
  select case p_type when 'whatsapp' then interval '24 hours'
                     when 'tiktok' then interval '48 hours' when 'wechat' then interval '48 hours' end
$$;
