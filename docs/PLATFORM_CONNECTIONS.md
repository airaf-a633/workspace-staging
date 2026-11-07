# Every platform we connect: requirements and how to configure each

*Written 5 November 2026 for the owner's configuration day (6 November). Facts come from the research already done in [CHANNELS_RESEARCH.md](CHANNELS_RESEARCH.md) (read from each platform's own pages) and from the code. Where a platform's pages did not say something, it is marked **not confirmed**. **Never send a secret (token, password, key) to anyone in chat or email.** Put it in your own `.env`, Vercel, Fly or the Relay screen it belongs to. Variable names and where each goes: [ENVIRONMENT.md](ENVIRONMENT.md). Order of deploy steps: [DEPLOY_DAY.md](DEPLOY_DAY.md).*

## Decisions this guide rests on (locked 5 November)

| Decision | Answer |
|---|---|
| What launches on 15 November | A private free pilot for invited businesses |
| Channels switched on for the pilot | Website chat, Email, Telegram, LINE, Discord, **Slack** |
| Meta (WhatsApp, Instagram, Messenger) | Not started. Verification begins now; WhatsApp is built and is switched on once a real test passes. Instagram and Messenger are **not built** |
| Slack | **On.** Risk: I could not confirm that other businesses can install the Relay Slack app without a Slack Marketplace listing. It is the first thing to test; if it fails, Slack comes off again |
| Teams, SMS, Voice, Viber, X, TikTok, WeChat, Apple | Built (except as noted) but shown "coming soon" in the pilot |
| Database | One project: the staging project becomes the pilot's. Before any pilot signs up: run the browser tests, then delete the seed accounts (they share the password `Password1234`), then verify (see [DEPLOY_DAY.md](DEPLOY_DAY.md)) |
| If the date is at risk | The owner has said it will be done on time |

## How the connections work, in one paragraph

Two kinds of setup exist. **Ours, once** (the platform): the database, the website host, the worker host, the domain, the email service, and for Slack and Meta the single Relay app that many businesses install. **Each business's own** (the customer): for Telegram, LINE and Discord each business makes its own bot or account and pastes its token into Relay (kept in Supabase's Vault; Relay staff never see it). So tomorrow you set up our platform and make **one test account of each channel** to prove it works; pilots later make their own from the steps inside Relay.

---

## Part 1. Our platform (do these first; nothing works without them)

| Piece | What you need | Time | Notes |
|---|---|---|---|
| **Supabase** (database, sign-in) | The `workspace-staging` project awake, on the Pro plan; the project URL, the anon key, the service-role key and the database connection string (Session pooler) | 20 min + waking | Keys: Dashboard › Connect. Check Pro's backup terms yourself: I have not. Auth settings, including custom SMTP: [DEPLOY_DAY.md](DEPLOY_DAY.md) step 4 |
| **Vercel** (the web app) | The existing project, root `apps/web`; environment variables from [ENVIRONMENT.md](ENVIRONMENT.md) | 20 min | `NEXT_PUBLIC_SITE_URL` must be the final https address. Do **not** set `SITE_MODE` |
| **Fly.io** (worker and Discord Gateway) | An account with a card; follow [DEPLOY_WORKER.md](DEPLOY_WORKER.md) | 30 min | About $7.40 a month. The image has never been built: send the first error if it fails |
| **A domain** | One you own, with DNS access | 15 min | Used for the app address and for email (a sending and an inbound sub-domain) |
| **Postmark** (email) | An account, then its review (about a day), a Server, a verified sending domain, an inbound domain | 1 hour + review | Also provides the SMTP that sign-up emails need. Details under Email below |

## Part 2. The six pilot channels

### Website chat: needs nothing from anyone
- **Requires:** nothing external. No account, no review, no cost.
- **Configure:** Settings › Channels › Website chat. Relay shows one line (`<script src="https://YOUR-APP/widget.js" data-relay-key="..." async></script>`) to paste into the site. It is built from `NEXT_PUBLIC_SITE_URL`.
- **Test:** open a page with the line, send a message as a visitor, see it in the Inbox, reply, see the reply in the widget.

### Email (Postmark): the one with the most setup
- **Requires:** a Postmark account **approved** to send to others (reply to their approval email saying what Relay is), a domain, and DNS access.
- **Steps (full list with every variable: [FOUNDER_SETUP.md](FOUNDER_SETUP.md) section 2):**
  1. Create a Postmark **Server** named "Relay". Put its Server API token in the worker as `POSTMARK_SERVER_TOKEN`.
  2. Add a **sending domain** (e.g. `mail.yourdomain.com`) in Postmark and add the DKIM and Return-Path records it shows. Set `EMAIL_SEND_DOMAIN` in the worker.
  3. Set up the **inbound domain** (e.g. `in.yourdomain.com`): MX record to `inbound.postmarkapp.com`; in Postmark › Server › Inbound set the domain and the webhook `https://USER:PASSWORD@YOUR-APP/api/webhooks/postmark` (you choose USER and PASSWORD: 16 or more random characters each; they are `POSTMARK_INBOUND_USER` and `POSTMARK_INBOUND_PASSWORD` in Vercel). `INBOUND_EMAIL_DOMAIN` goes in both Vercel and the worker.
  4. Optional: Postmark's Account API token as `POSTMARK_ACCOUNT_TOKEN` (lets a business verify its own sending domain).
  5. **Also set Postmark's SMTP as Supabase's custom SMTP** (Dashboard › Authentication › Emails › SMTP settings). Without it, nobody but your own Supabase team receives sign-up or sign-in emails.
- **In Relay:** Settings › Channels › Email gives each business a forwarding address like `northwind@in.yourdomain.com`; the business forwards its support address to it.
- **Test:** forward an email in, see it in the Inbox, reply, see it arrive from your sending domain.
- **Not needed for the pilot, and not set up:** "Continue with Outlook" (Microsoft Entra app plus publisher verification) and "Continue with Gmail" (Google OAuth; restricted scopes need a paid security assessment for more than 100 users).

### Telegram: free, self-serve, ten minutes
- **Requires:** a Telegram account. Nothing to approve.
- **Create:** in Telegram chat with `@BotFather`, send `/newbot`, follow the steps, copy the token.
- **Configure:** Settings › Channels › Telegram, paste the token, Connect. Relay registers the webhook itself (it needs the https site address); the page then shows the bot's link.
- **Test:** open the bot's link, press Start, write; reply from the Inbox.
- **Facts (from Telegram's pages):** the customer must message first; no time limit on replying. **Not confirmed:** the exact error when someone blocks the bot.

### LINE: free to start, twenty minutes
- **Requires:** a LINE Official Account with the Messaging API on. You pick a *provider* once and **LINE says it cannot be changed afterwards.**
- **Copy two values** from the LINE Developers Console: the **Channel secret** (Basic settings) and a **Channel access token (long-lived)** (Messaging API tab, Issue).
- **Configure:** Settings › Channels › LINE, paste both, Connect. Then paste the **webhook address Relay shows** into the console (Messaging API › Webhook URL › Update › **Verify** must say Success › turn on **Use webhook**).
- **Turn off LINE's own Greeting message and Auto-reply messages** (both on by default), or customers get two replies.
- **Costs:** the free plan has a small monthly message allowance; replies within about a minute are free, later pushes count against it. **Not confirmed:** the exact error when the allowance runs out.

### Discord: token only, but needs the always-on Gateway
- **Requires:** a Discord account and a server of your own. **The Gateway must be running** on Fly (Part 1): Discord only delivers messages over an open connection; messages sent while it is down are lost.
- **Create:** Discord Developer Portal › New Application › **Bot** page › copy the token. No privileged intent is needed (Discord's page says a message that mentions the bot arrives with its content).
- **Configure:** Settings › Channels › Discord, paste the token, Connect. Within a minute the page says connected and shows **Add the bot to a server**; use that link.
- **Test:** direct-message the bot from a second Discord account; mention it in a server channel (@bot hello).
- **Not confirmed:** whether someone who shares no server with the bot can message it; what Discord answers when a person has closed their DMs; the server limit for an unverified bot.

### Slack: ON, with one big unknown
- **Requires (ours, once):** a Slack account and one **Relay Slack app** created at api.slack.com/apps. Each business then clicks "Add to Slack".
- **Create the app:** Bot scopes `channels:history`, `groups:history`, `chat:write`, `users:read`, `files:read`. Redirect URL `https://YOUR-APP/api/oauth/slack/callback`. Event Subscriptions on, request URL `https://YOUR-APP/api/webhooks/slack` (Slack checks it at once, so the site must be live), bot events `message.channels`, `message.groups`, `app_uninstalled`. Manage Distribution: allow other workspaces to install.
- **Three values go in Vercel (web app only):** `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` (all from Basic Information). Redeploy.
- **Configure per business:** Settings › Channels › Slack › Add to Slack, approve.
- **The unknown to test first:** Slack's pages did not say whether a distributed app can be installed by other workspaces **without a Marketplace listing**. Install it from a *second, separate* Slack workspace on day one. If Slack blocks that, Slack comes off the pilot again.
- **How it works:** one chat per outside person per Slack channel, via a Slack Connect channel the app is in; replies go in the Slack thread. **Not confirmed:** Slack Connect availability on each plan, and who on each side may add an app to a shared channel.

---

## Part 3. Meta: WhatsApp, Instagram, Messenger (the longest wait)

**What is built:** WhatsApp (Cloud API) is built end to end: receiving, replying inside the 24-hour window, media, delivery ticks. **Instagram and Messenger are not built** (there is no connect screen). The in-app "Embedded Signup" (customers connect their own number in a few clicks) is **not built**: today an owner pastes the number's IDs and a token.

**The chain, in order (the first steps can start tomorrow):**
1. **Meta Business verification** (Business Settings › Security Center › Start verification, with company documents). A few days to two weeks. Needs the company licence, so it depends on your paperwork.
2. **A Meta developer app** (developers.facebook.com, type Business) with the **WhatsApp** product. 20 minutes. Put the App ID in `.env` as `META_APP_ID`, the App Secret as `META_APP_SECRET` (Vercel), and a random **webhook verify token** as `META_WEBHOOK_VERIFY_TOKEN` (Vercel). `WHATSAPP_API_VERSION` is already `v25.0`.
3. **The free test number** (WhatsApp › API Setup): add your own phone as a recipient (up to 5). Webhook: callback `https://YOUR-APP/api/webhooks/whatsapp`, the verify token above, **Verify and save**, subscribe to **messages**.
4. **A permanent token:** Business Settings › System users › create one with `whatsapp_business_messaging` and `whatsapp_business_management`. (The temporary token expires after 24 hours.)
5. **Connect in Relay:** Settings › WhatsApp numbers › paste the Phone number ID, the WhatsApp Business Account ID and the token. Send a message to the test number; reply from the Inbox.
6. **App Review** for the two permissions (one to three weeks; needs a screen recording of Relay in use, which I will script with you), then **Tech Provider** status for Embedded Signup (weeks; later).
- **To show WhatsApp in the pilot:** after step 5 works, tell me; I add it to the list of connectable channels (one line) and it stops saying "coming soon".
- **Costs:** WhatsApp messages are charged by Meta, at cost, not by Relay. **Not confirmed here:** Meta's current prices; check Meta's pricing page.

---

## Part 4. Built, but shown "coming soon" in the pilot

| Channel | What it needs | Cost | Notes |
|---|---|---|---|
| **SMS** | A Twilio account and a number; the Account SID and Auth Token pasted into Relay; the webhook address Relay shows pasted into the number | Per message, plus carrier registration in some countries (US: A2P 10DLC or a verified toll-free number) | Twilio's own pages disagreed on fees, so none are quoted |
| **Voice** | The same Twilio account and a voice-capable number, plus the phone that should ring | Per minute | Recording-notice rules vary by country; Relay plays only the words the business writes |
| **Microsoft Teams** | An Azure account (a bot registration) and a Microsoft 365 admin to approve it per business | Free to low; Azure may charge | Rules around Teams bots are changing; highest build risk of the working channels |
| **Viber** | A commercial Viber agreement (bot token only comes with a contract) | Monthly minimum plus per message | |
| **X (Twitter)** | An X developer account, pay-per-use credits (about $0.010 per message received and $0.015 per reply at the last check) | Per request | Webhook reliability reported poor |
| **TikTok, WeChat, Apple Messages** | **Cannot be connected yet.** TikTok needs TikTok's approval of our app; WeChat needs a verified Service Account (and a reviewer who reads Chinese); Apple needs an Apple-approved provider | | The pages show "Request access" |
| **API** | Nothing: our own channel, for a business's own system to post messages | None | Not offered in the pilot list |

---

## What to send back to me tomorrow (never the secrets themselves)

For each piece you finish, tell me: **done / not done / the exact screen text of any error.** Specifically:
1. The Supabase project is awake and on Pro, and the migration dry run works (`node scripts/db-apply-remote.mjs`).
2. The Vercel address (the https site address), and whether `/sign-up` loads.
3. `fly status` and `fly scale show` output once the worker is up.
4. Whether Postmark approved the account, and the result of a test forward.
5. For each channel: connected or not, and whether a message went in and a reply went out.
6. For Slack: whether a **second** workspace could install the app.
7. For Meta: the date verification was submitted, and any request Meta makes for documents.
