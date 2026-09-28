-- M2.1 pipeline: storage, queue claims, retries, dead-letter, replay, and that app users can't touch any of it.
begin;
select plan(13);

-- As the database owner (stands in for the service role, which the server uses)
select ok(public.record_webhook('whatsapp', '{"object":"whatsapp_business_account"}', true) > 0, 'a verified webhook is stored');
select is((select count(*)::int from public.jobs where queue = 'whatsapp_event' and status = 'queued'), 1, 'and queued for the worker');
select lives_ok($$ select public.record_webhook('whatsapp', '{"forged":true}', false) $$, 'an unverified webhook is stored for audit');
select is((select count(*)::int from public.jobs where queue = 'whatsapp_event'), 1, 'but never queued');

create temp table claimed on commit drop as select * from public.claim_jobs('whatsapp_event', 10, '60 seconds');
select is((select count(*)::int from claimed), 1, 'the worker claims the job');
select is((select count(*)::int from public.claim_jobs('whatsapp_event', 10, '60 seconds')), 0, 'a second worker cannot claim the same job while leased');

select is(public.fail_job((select id from claimed), 'boom'), 'retry', 'a failure schedules a retry');
select ok((select run_at > now() from public.jobs where id = (select id from claimed)), 'the retry waits (backoff)');

update public.jobs set attempts = max_attempts where id = (select id from claimed);
select is(public.fail_job((select id from claimed), 'boom again'), 'dead', 'after max attempts the job is dead-lettered');

select lives_ok($$ select public.replay_webhook((select min(id) from public.webhook_events where signature_valid)) $$, 'a stored event can be replayed');
select is((select count(*)::int from public.jobs where payload ? 'replay'), 1, 'replay queues it again');

-- App users see and do nothing here
set local role authenticated;
select throws_ok($$ select count(*) from public.webhook_events $$, '42501', null, 'signed-in users cannot read webhook events');
select throws_ok($$ select public.claim_jobs('whatsapp_event') $$, '42501', null, 'signed-in users cannot claim jobs');

select * from finish();
rollback;
