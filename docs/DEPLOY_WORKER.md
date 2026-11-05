# Running the worker and the Discord Gateway on Fly.io

*Decided 2 November 2026. Prepared, not yet deployed: staging is paused and no Fly account exists. Nothing here has been run.*

## What runs, and why it can't be on Vercel

| Process | What it does | If it is off |
|---|---|---|
| **worker** | Claims queued jobs: files incoming messages, sends replies, downloads pictures and files, renews tokens, checks mail. | Replies stay "queued", incoming messages wait (nothing is lost; they are processed when it starts). |
| **gateway** | Holds one always-open Discord connection for every connected Discord bot and queues their messages. | Discord messages that arrive while it is off are **lost**: Discord delivers them only over a connection that is open. |

Both need to be running all the time. Vercel runs short-lived requests, so neither fits there. The web app stays on Vercel.

## The decision

- **Host: Fly.io, Frankfurt (`fra`)**, one Fly app with two process groups, `worker` and `gateway`, from one image (`Dockerfile`, `fly.toml` at the repository root). It is what the engineering plan named. I verified Fly's own pages for this (below). I did **not** research Render, Railway or others; if you want that comparison, ask.
- **Exactly one machine per group, no standby.** Fly's pages say a first deploy makes one or two machines per group (two for redundancy), so the commands below deliberately set one. Two Gateways would fight over Discord's limit of 1,000 connections a day (going over resets the bot's token). Two workers would be safe but pointless at this size.
- **Accepted for now:** during a deploy or after a crash the Gateway is off for about a minute, and Discord messages sent in that gap are lost. Resuming across restarts would need the connection's session saved in the database; Discord's pages do not say how long a dropped session can be resumed, so that waits for a test on a real bot.
- **Starts with staging**, as soon as it is restored.

## What it costs (Fly's pricing page, read 2 November 2026)

| | Per month |
|---|---|
| worker, shared-cpu-1x, 512 MB | $3.69 |
| gateway, shared-cpu-1x, 512 MB | $3.69 |
| **Total** | **about $7.40** |

Prices assume 30 days of continuous running and are billed by the second. There is no free tier for new organizations (only a trial of up to 2 hours or 7 days). Outbound data is $0.02 per GB in Europe; inbound is free. A 256 MB machine is $2.19; I chose 512 MB because Node plus the TypeScript runner may be tight in 256 MB and I have not measured it. After a week of running, look at the machine's memory (`fly status`, Fly's dashboard); if there is room, drop to 256 MB in `fly.toml`.

## What I verified on Fly's pages

- Frankfurt is region `fra`.
- `[processes]` maps group names to start commands; `[[vm]]` and `[[restart]]` apply to all groups when they name none.
- An app with no `[http_service]` or `[[services]]` has no public address. That fits a worker. The page does not say such an app stays running, so check `fly status` after the first deploy.
- `[[restart]] policy = "always"` restarts a machine whatever its exit code; the default is `on-failure`.
- A first deploy creates two machines per group. `fly deploy --ha=false` creates one; `fly scale count worker=1 gateway=1` sets the counts; scale changes survive later deploys (except scaling to zero). Verify with `fly scale show`.
- `fly secrets set NAME=value ...` sets several secrets; setting them restarts the machines, `--stage` holds them until the next deploy.
- App names are unique across all of Fly.io, so pick your own with `--name`.

## What I could not verify

- **The Docker image has never been built.** This machine has no Docker. The `Dockerfile` follows the usual pnpm pattern and the worker's real dependencies (only `@app/worker`, `@app/domain` and `@app/whatsapp`; I checked that none of them imports the web app). If `fly deploy` fails during the build, send me the error first.
- How Fly decides the Docker build context. I placed `Dockerfile` and `fly.toml` together at the repository root, which Fly's launch page describes as "the project source directory".
- Whether `fly launch --no-deploy` keeps the `[processes]` section when it copies `fly.toml` (the page says it offers to copy it). Check the file after launching.
- How much memory the worker and Gateway really use.

## Your steps (about 30 minutes; the first time)

Never paste a secret into chat. Type these in your own terminal.

1. **Create a Fly.io account** and add a payment card (there is no free tier). Install the `flyctl` command and run `fly auth login`.
2. **Create the app without deploying**, from the repository root. Pick a name nobody else has:
   ```bash
   fly launch --no-deploy --name YOUR-UNIQUE-NAME
   ```
   When it offers to copy the existing `fly.toml`, say yes. Open `fly.toml` afterwards and check `[processes]` is still there.
3. **Set the secrets.** These two are required; the worker will not start without them:
   ```bash
   fly secrets set --stage SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
   ```
   Add the ones for the channels you use (same names and values as in your `.env`):
   - `APP_URL` (the web app's public https address; used by SMS delivery reports and Outlook notifications)
   - Email: `INBOUND_EMAIL_DOMAIN`, `POSTMARK_SERVER_TOKEN`, `EMAIL_SEND_DOMAIN`
   - Outlook: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`; Gmail: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `SENTRY_DSN` if you use Sentry
4. **Deploy one machine per group:**
   ```bash
   fly deploy --ha=false
   fly scale count worker=1 gateway=1
   fly scale show
   ```
   `fly scale show` must say 1 and 1.
5. **Check it:**
   ```bash
   fly status
   fly logs
   ```
   The logs should say `worker started against <your Supabase host>` and `gateway started against <your Supabase host>`. If the machines are not "started", send me `fly status`.
6. **Stop running the worker on your laptop** (`pnpm worker`). Running both is harmless for messages (each has its own id) but wasteful.

## Changing it later

- **Deploy new code:** `fly deploy` (the count stays at one each).
- **Change a secret:** `fly secrets set NAME=value` (restarts both; the Gateway is off about a minute).
- **Gateway gap:** deploy at a quiet time. The Discord page in the web app tells the business when the connection is down.
- **Never** run `fly scale count gateway=2`.
- **Scaling the worker later** is safe: jobs are claimed with a lease, so several workers share the queue.
