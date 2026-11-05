# The other 13 channels: build plan

*Draft of 1 November 2026, based on [CHANNELS_RESEARCH.md](CHANNELS_RESEARCH.md). Nothing here is built yet. The decisions at the end are yours to make before I start.*

## What already exists that we reuse

- The `channels` table already allows all 13 types, with `external_id`, `team_id`, `status` and `settings`.
- `ingest_inbound()` turns any inbound message into a customer, a conversation and a message, with duplicate protection. `send_reply()` queues the reply.
- The worker picks queued sends up through the `jobs` table and calls one **adapter per channel type**. A failed send gets a plain reason and retries with backoff. The adapters for WhatsApp, website chat and email show the pattern.
- Secrets already go in Supabase Vault (the email connections do this).
- The Channels page, the connect-flow shell and the inbox's per-channel rules exist as designs.

## Step 0: shared groundwork (built once, used by all 13)

Without this every channel would copy the same code. It's about a third of the effort, and it's what makes each later channel small.

1. **Credentials store.** One table linking a channel to its secrets in Vault (bot tokens, signing secrets, API keys). The browser never sees them; only the server and worker read them.
2. **Webhook intake pattern.** One route per provider (`/api/webhooks/<provider>/<channel key>`) that checks the provider's signature, answers fast, and queues the work. Idempotent, like WhatsApp and Postmark today.
3. **Channel capabilities table** in `packages/domain`: for each channel, the reply window (none, 24h, 48h, "reply token"), what it can send (text, image, file, audio), maximum length, threads, templates. The composer reads it to block or warn ("This chat is outside TikTok's 48-hour window") instead of letting a send fail.
4. **Worker adapter contract** plus a **shared mock-provider harness**: tests run each adapter against a fake of the provider, so every channel gets real tests with no accounts.
5. **Media in and out**, generalised from WhatsApp: download a file from a URL (with the provider's auth) into storage; upload for sending.
6. **Opt-out and block sync**: when a provider says "this person blocked you / texted STOP", mark them do-not-contact on that channel in our consent list.
7. **A generic "connect with credentials" screen** in the same plain style as the email forms (paste two things, press Connect, we test them and say what's wrong in plain words).

## The channels, in order

Each step is one feature: built, tested, shown to you, then pushed on your say-so.

### Wave 1: no outside approval needed (I can build and test all of it)

| Step | Channel | What gets built |
|---|---|---|
| 1 | **API** | Per-inbox keys (shown once, stored hashed). `POST /api/v1/inboxes/{id}/messages` for inbound with an idempotency key; outbound replies delivered to the customer's webhook, HMAC-signed, retried through the queue. Attachments by URL. A docs page with copy-paste examples. Doubles as our end-to-end test harness. |
| 2 | **Telegram** | Connect: paste the bot token from @BotFather; we set the webhook and show the `t.me` link and a QR code. Inbound text, photos, files, voice notes, stickers (shown as images); outbound text and files. Business-account connections as an option. Block detection ("the person stopped the bot"). |
| 3 | **LINE** | Connect: paste channel secret and access token; we verify and show the webhook address to paste back into LINE. Inbound with signature check; reply with the one-time token when it's fresh, else push (with a "this may use your plan's quota" note). Images, stickers, files. |

### Wave 2: Twilio (one connection, two channels)

| Step | Channel | What gets built |
|---|---|---|
| 4 | **SMS** | Connect with the customer's own Twilio account and number. Inbound and delivery receipts; segment count shown before sending; STOP/START mapped to consent; US registration status explained in plain steps. |
| 5 | **Voice** | Decided 2026-11-02, inbound only: calls ring the owner's phone, then a voicemail (owner-written greeting and recording notice) with a player in the chat, and missed and answered calls as cards with their length. No transcript, no callbacks from Relay, no softphone. See PRODUCT_DECISIONS.md. |

### Wave 3: workspace apps

| Step | Channel | What gets built |
|---|---|---|
| 6 | **Slack** | Install to a workspace (OAuth). Replies in threads; Slack Connect customers appear as customers. No history backfill (Slack's rate limits). Marketplace review is a later task for you. |
| 7 | **Discord** | A small always-on gateway service. DMs and a "help" channel where each question becomes a conversation. Hosting decided 2026-11-02: Fly.io (docs/DEPLOY_WORKER.md). |
| 8 | **Microsoft Teams** | Internal help desk only: a single-tenant bot the customer's admin installs. Customer-facing Teams is not promised. |

### Wave 4: gated channels (built after the gate opens, or behind "request access")

| Step | Channel | Gate |
|---|---|---|
| 9 | **TikTok** | Request access only: Relay's app must be approved by TikTok. |
| 10 | **X** | Built 2026-11-02 through the business's own X developer app (they pay X). See PRODUCT_DECISIONS. |
| 11 | **Viber** | Built 2026-11-02 for a business that already has a Viber bot (its contract is theirs). |
| 12 | **WeChat** | Request access only: account rules unconfirmed (English docs untranslated). |
| 13 | **Apple Messages** | Request access only: needs an Apple-approved provider; none researched yet. |

For Wave 4 the code is small once access exists; the work is the application and the waiting. I'd put each one on your setup list so the application runs while I build other things.

## How each channel is tested (so "done" means done)

1. **Contract tests** against the shared mock provider: signature accepted and rejected, every message type mapped, duplicates ignored, send errors turned into plain reasons, rate limits and retries.
2. **Database tests** (pgTAP) for anything new in the database: keys, credentials, consent sync.
3. **Browser tests** (Playwright): connect flow (with the mock), the inbox showing a message from that channel, replying, the blocked-composer states.
4. **Live checklist** per channel in `docs/FOUNDER_SETUP.md`: the exact steps to send a real message through a real account, so you can see it work. I can't sign in to your accounts, so this part is yours.
5. Staging must be awake to run 2 to 4 for real; until then 1 and the preview parts run.

## What I need from you, per wave

- **Wave 1:** nothing. For the live check, a Telegram account and (for LINE) a free LINE Official Account.
- **Wave 2:** a Twilio account and one number for testing. A test number works for non-US messages without registration; US needs the registration for real customers.
- **Wave 3:** a Slack workspace you control, a Discord server and bot, a Microsoft 365 test tenant. Plus the worker hosting decision (Discord needs it).
- **Wave 4:** TikTok developer and business accounts and the app application; an X developer account and a budget; Viber, WeChat and Apple contracts only if a customer asks.

## Risks I'd flag

- **Rules change under us.** TikTok, X, Slack and Teams all changed their terms in the last 18 months. Everything in the research marked unverified gets checked against the platform's own page on the day we build it.
- **Cost surprises.** SMS, Voice, X and Viber cost money per message. The plan is that the customer's own account pays (their Twilio, their LINE plan), so Relay never carries message costs it didn't price in.
- **Review delays** (TikTok, Slack Marketplace, Apple) can take weeks; they run in parallel to the build.
- **The Channels page promises 18 channels** in the preview. Any channel we can't ship should say so honestly ("Request access") rather than look connected.
