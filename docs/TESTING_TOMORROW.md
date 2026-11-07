# Testing the channels on staging (8 to 9 November)

*For the person creating an account on staging and trying website chat, Discord, Telegram and Slack. The database is ready (all migrations applied, all tests passing on it). **The web app and worker are not deployed yet**, so first pick how to reach the app.*

## Step 0. Get the app running somewhere (pick one)

| | Good for | Cost of setting up |
|---|---|---|
| **A. A second Vercel project (recommended)** | Everything: sign-up, website chat, and Telegram, Slack (they need a public https address) | About 20 minutes. The existing `workspace-staging` Vercel project is the password-protected sample-data preview (`SITE_MODE=preview`), so **do not reuse it**. Create a new project from the same repository: root directory `apps/web`, branch `ui/design-foundations`, environment variables from [ENVIRONMENT.md](ENVIRONMENT.md), `NEXT_PUBLIC_SITE_URL` set to the new project's https address, and **no** `SITE_MODE` or `PREVIEW_PASSWORD`. Then in Supabase › Authentication › URL Configuration add `https://THAT-ADDRESS/auth/callback` |
| **B. Your own machine** | Sign-up and website chat only (a local address is `http`, and Telegram and Slack refuse it) | Fast: `pnpm --filter @app/web dev` with the `.env` that already points at staging. For Telegram and Slack you would also need a tunnel that gives an https address; put it in `NEXT_PUBLIC_SITE_URL` |

**The worker** (sends replies, downloads files, runs the alerts) and **the Discord Gateway** must also run, or replies stay "queued" and Discord receives nothing. Quickest: on your machine, two terminals, `pnpm --filter @app/worker start` and `pnpm --filter @app/worker gateway`. Proper: Fly.io ([DEPLOY_WORKER.md](DEPLOY_WORKER.md)).

## Step 1. Create your account

Sign-up needs an **invite code** (I gave you one in chat; it is not in the repository). Open `/sign-up`, fill in the form, **enter the code**, confirm. Confirmation emails only reach people on your own Supabase team until custom SMTP is set up ([DEPLOY_DAY.md](DEPLOY_DAY.md) step 4), so sign up with an address that is on your Supabase team.

Then "Create your business" and you land on Home.

## Step 2. Each channel (full detail in [PLATFORM_CONNECTIONS.md](PLATFORM_CONNECTIONS.md))

1. **Website chat:** Settings › Channels › Website chat › create it. Copy the one-line snippet onto any web page (a local file works with option B), open the page, send a message as a visitor, see it in the Inbox (open the **All** tab), reply from the Inbox (press **Take this chat**, type, **Send**), see the reply in the widget.
2. **Telegram:** make a bot with `@BotFather`, paste the token in Settings › Channels › Telegram. Needs the https address.
3. **Discord:** make an application, copy the bot token from its Bot page, paste it in Settings › Channels › Discord, then use "Add the bot to a server". Needs the Gateway running.
4. **Slack:** create the Relay Slack app (steps in PLATFORM_CONNECTIONS.md Part 2), put the three `SLACK_*` values in the web app's environment, redeploy, then Settings › Channels › Slack › Add to Slack. **Try installing it from a second, separate Slack workspace** to find out whether other businesses can install it.

## What to tell me

For each step: **worked / did not work**, and the exact words on the screen of anything that failed. Never send a token or secret; if one is needed, put it in the environment or the Relay screen it belongs to.

## Things you will notice, so they do not surprise you

- The Inbox opens on **Mine**, or on **Waiting for someone** when nothing is yours yet. New customers' chats are under "Waiting for someone" or **All**.
- Campaigns, Help Center and Billing say **Preview**: sample data, nothing is sent or charged.
- Seed test accounts (`*.test`) still exist on staging and will be deleted before real pilots ([DEPLOY_DAY.md](DEPLOY_DAY.md) section 0).
