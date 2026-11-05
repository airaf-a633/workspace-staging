-- Viber: its text limit, and no reply window that Viber doesn't publish.
begin;
select plan(5);
select is(public.channel_max_length('viber'), 7000, 'Viber takes 7,000 characters');
select is(public.channel_max_length('discord'), 2000, 'Discord keeps 2,000');
select is(public.channel_max_length('telegram'), 4096, 'the rest keep 4,096');
select is(public.channel_reply_window('viber'), null, 'a reply to Viber is never blocked by a window');
select is(public.channel_reply_window('whatsapp'), interval '24 hours', 'WhatsApp keeps its 24 hours');
select * from finish();
rollback;
