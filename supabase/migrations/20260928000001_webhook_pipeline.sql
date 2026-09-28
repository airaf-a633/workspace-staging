-- M2.1 Webhook pipeline: every inbound provider event is stored before processing, then
-- handled by the worker through a small job queue (claim with SKIP LOCKED, retry with
-- backoff, dead-letter after max attempts). Only the server (service role) touches these
-- tables; row-level security is on with no policies, so app users can never read them.

create table public.webhook_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('whatsapp')),
  payload jsonb not null,
  signature_valid boolean not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  outcome text check (outcome in ('processed', 'ignored', 'failed')),
  note text
);
create index webhook_events_unprocessed_idx on public.webhook_events (received_at) where processed_at is null;

create table public.jobs (
  id bigint generated always as identity primary key,
  queue text not null check (queue ~ '^[a-z_]{2,40}$'),
  payload jsonb not null,
  priority smallint not null default 0,            -- higher runs first (history sync = urgent)
  run_at timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5 check (max_attempts between 1 and 50),
  locked_until timestamptz,
  last_error text,
  status text not null default 'queued' check (status in ('queued', 'done', 'dead')),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index jobs_ready_idx on public.jobs (queue, priority desc, run_at) where status = 'queued';

alter table public.webhook_events enable row level security;
alter table public.jobs enable row level security;
revoke all on public.webhook_events, public.jobs from anon, authenticated;

-- Store a verified webhook and queue it for the worker, in one transaction.
create function public.record_webhook(p_provider text, p_payload jsonb, p_signature_valid boolean)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  event_id bigint;
begin
  insert into public.webhook_events (provider, payload, signature_valid)
  values (p_provider, p_payload, p_signature_valid)
  returning id into event_id;
  if p_signature_valid then
    insert into public.jobs (queue, payload) values (p_provider || '_event', jsonb_build_object('event_id', event_id));
  end if;
  return event_id;
end $$;

create function public.enqueue_job(p_queue text, p_payload jsonb, p_priority smallint default 0, p_run_at timestamptz default now())
returns bigint language sql security definer set search_path = '' as $$
  insert into public.jobs (queue, payload, priority, run_at) values (p_queue, p_payload, p_priority, p_run_at) returning id
$$;

-- Claim up to p_limit ready jobs for p_lease. Concurrent workers never get the same job.
create function public.claim_jobs(p_queue text, p_limit int default 10, p_lease interval default '60 seconds')
returns setof public.jobs language sql security definer set search_path = '' as $$
  update public.jobs j
     set attempts = j.attempts + 1, locked_until = now() + p_lease
   where j.id in (
     select id from public.jobs
      where queue = p_queue and status = 'queued' and run_at <= now()
        and (locked_until is null or locked_until < now())
      order by priority desc, run_at, id
      limit p_limit
      for update skip locked)
  returning j.*
$$;

create function public.complete_job(p_id bigint)
returns void language sql security definer set search_path = '' as $$
  update public.jobs set status = 'done', finished_at = now(), locked_until = null where id = p_id
$$;

-- Retry with exponential backoff (5s, 20s, 80s, 5m20s ...); dead-letter after max_attempts.
create function public.fail_job(p_id bigint, p_error text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  j public.jobs;
begin
  select * into j from public.jobs where id = p_id for update;
  if j.attempts >= j.max_attempts then
    update public.jobs set status = 'dead', last_error = left(p_error, 2000), finished_at = now(), locked_until = null where id = p_id;
    return 'dead';
  end if;
  update public.jobs
     set last_error = left(p_error, 2000), locked_until = null,
         run_at = now() + (interval '5 seconds' * power(4, j.attempts - 1))
   where id = p_id;
  return 'retry';
end $$;

-- Replay: re-queue an already stored event (used by scripts/replay-webhook.mjs).
create function public.replay_webhook(p_event_id bigint)
returns bigint language sql security definer set search_path = '' as $$
  insert into public.jobs (queue, payload)
  select provider || '_event', jsonb_build_object('event_id', id, 'replay', true)
  from public.webhook_events where id = p_event_id and signature_valid
  returning id
$$;

-- Only the service role may call these.
revoke execute on function public.record_webhook(text, jsonb, boolean), public.enqueue_job(text, jsonb, smallint, timestamptz),
  public.claim_jobs(text, int, interval), public.complete_job(bigint), public.fail_job(bigint, text), public.replay_webhook(bigint)
  from public, anon, authenticated;
grant execute on function public.record_webhook(text, jsonb, boolean), public.enqueue_job(text, jsonb, smallint, timestamptz),
  public.claim_jobs(text, int, interval), public.complete_job(bigint), public.fail_job(bigint, text), public.replay_webhook(bigint)
  to service_role;
