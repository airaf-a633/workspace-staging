# Launch plan: private pilot on 15 November 2026

*Written 3 November 2026. This replaces "no fixed date" in [MILESTONES.md](MILESTONES.md) for the launch only. The dates below are a plan, not a promise: the first contact with a real server will find bugs, and some steps depend on outside companies.*

## What "launch" means (decided 3 November)

- **A private pilot.** A handful of invited businesses use Relay for real, **free**, with no card and no billing. Anyone creating an account needs an **invite code** (or a teammate's invitation).
- **Channels on day one:** Website chat, Email, Telegram, LINE and Discord. They need no platform review. Every other channel shows "coming soon".
- **Shown, but not live (labelled "Preview" or "Coming soon", never hidden):** WhatsApp, Instagram and Messenger (Meta verification has not started; it takes weeks), SMS and Voice, TikTok, WeChat, Apple, X, Viber, and the Help Center, Campaigns and Billing screens (designed screens with sample data, marked "Preview" in the menu and by a note on each screen). The public website shows every plan and price, with a note that the pilot is free.
- **Slack and Microsoft Teams:** the 3 November answer ticked both "Slack, Teams" and "None of these", so they are **off** until you say otherwise. They would each need another account and test.
- **Legal:** pilots sign a short pilot agreement ([PILOT_AGREEMENT_DRAFT.md](PILOT_AGREEMENT_DRAFT.md)). It is a starting point and needs a lawyer's eyes before you rely on it.

## Where we start (3 November)

| Done and tested without a server | Never run on a real server |
|---|---|
| Everything built since 19 October: channels, deals and tasks, notifications and Home, Reports, reply targets, invite-code sign-up. The database rules pass 32 test files; the production build succeeds. | All of it. Staging has been paused since 19 October. About 24 migrations (from `20261019000001`) are not on it, no worker is deployed, and no channel has been tried with its real provider. |

**The honest risk:** the next 3 days cannot be used to test anything for real. From the day staging is back, there are about 9 days to find and fix what breaks on first contact. A cut list below says what we drop first.

## The days

| Dates | You | Me |
|---|---|---|
| **Tue 3 – Thu 5 Nov** (no staging) | Start **Meta Business verification** (not needed for 15 Nov; it is the long wait for WhatsApp). Restore staging, and put it on **Supabase Pro** so it never pauses. Open the **Fly.io** account. Buy the **domain**. Create the **Postmark** account and start its review (about a day). Make the **Vercel** project for the app. | Done: invite-code sign-up, day-one channel list, pilot website, production build check, this plan, the migration script. Next: error monitoring, the pilot agreement draft, runbooks, tidy the "coming soon" screens. |
| **Fri 6 – Sat 7 Nov** (staging back) | Give me nothing secret in chat: put keys in `.env` and in Vercel/Fly. Run the commands in the next column when I ask. | Apply the missing migrations (`node scripts/db-apply-remote.mjs`), run the 32 test files on staging (`pnpm db:test:staging`), deploy the web app and the worker, run the live browser suite. Fix what breaks. |
| **Sun 8 – Tue 10 Nov** | Create the Telegram bot, LINE channel and Discord app; work through the channel checklists in [FOUNDER_SETUP.md](FOUNDER_SETUP.md) section 7 with me. Set up email (Postmark inbound and sending domain, and Supabase **custom SMTP**, see risks). | Fix, one channel at a time: Website chat, Email, Telegram, LINE, Discord. Then deals, tasks, notifications, Reports and reply targets on real data. |
| **Wed 11 – Thu 12 Nov** | Run the **real-person test** (3 to 5 people who have never seen Relay, about 2 hours, [SIMPLICITY_AUDIT.md](SIMPLICITY_AUDIT.md)). Rehearse onboarding yourself with a fresh invite code. | Fix what they trip on. Test backup and restore. Check the invite gate from outside. |
| **Fri 13 – Sat 14 Nov** | Send the invite codes and pilot agreements to the first businesses. | Freeze features. Only fixes. One last full test pass. |
| **Sun 15 Nov** | Launch. | On call. |

## Go / no-go on 14 November (every line must be true)

- [ ] All migrations are on the pilot database and the test files pass there.
- [ ] The web app and the worker are deployed and the worker is processing messages (a reply you send leaves "queued").
- [ ] Each of the five channels has received and sent a real message end to end.
- [ ] Someone without an invite code **cannot** create an account (try it), and someone with one can, including receiving the confirmation email.
- [ ] `pnpm db:audit` lists only the three harmless lookup helpers an anonymous visitor may run, no tables, no policies (since the review fixes of 5 November the invite-code check is no longer open to visitors). (It runs on the local copy of the schema; against the real database, also check in the Supabase SQL editor that the migrations `20261107000001`, `20261107000002` and `20261108000002` are applied.)
- [ ] A business owner can invite a teammate: the owner copies the invitation link (Relay does not email it) and sends it; the teammate opens it, signs up with the **same email address the invitation names**, confirms the sign-up email, and joins.
- [ ] Backups are on and one restore has been tried.
- [ ] Errors reach somewhere you will look (Vercel and Fly logs at least; Sentry if set up).
- [ ] The pilot agreement is in front of every pilot, and `apps/web/src/lib/company.ts` is filled in so no legal page shows a `[SQUARE BRACKET]` placeholder (check /terms, /privacy and /dpa).
- [ ] "Send feedback" works for a pilot, and you can read what they sent (Supabase › `pilot_feedback`).
- [ ] The real-person test found nothing that stops a person finishing the first task.

## What we drop first if time runs out

1. Discord (it needs the always-on Gateway process on Fly as well as the worker).
2. LINE.
3. The reply-target alerts (the inbox flags still work without the five-minute sweep).
4. Telegram.

Website chat and Email stay: without them there is nothing to show a pilot.

## Risks you should know about

- **Email to pilots needs custom SMTP.** Supabase's built-in email service is limited to 2 messages an hour, only sends to addresses on your own Supabase team, and "is not meant for production use" (Supabase docs, [auth-smtp](https://supabase.com/docs/guides/auth/auth-smtp)). Without your own SMTP (Postmark can do it), no pilot will receive a sign-up confirmation or sign-in link. Postmark must have approved your account first.
- **Fly.io has never built the worker image.** The `Dockerfile` was never built (no Docker here). The first deploy is the first test.
- **Nothing since 19 October has met a real provider.** Expect real-world differences from the docs on each channel.
- **Discord needs a second always-on process** (the Gateway). If it falls over, Discord messages stop arriving.
- **The invite gate lives in the database**, so it needs the migration `20261107000001_pilot_access` applied. If it is missing, sign-up is open. The go/no-go list checks this from outside.
- **The website now showcases everything** (founder's decision, 3 November). Prices are shown as planned prices with a pilot-is-free note; WhatsApp, Instagram and Messenger are marked "on the way" in the Features page, the FAQ and the comparison pages. A pilot who clicks Campaigns, the Help Center or Billing in the app sees sample data under a "Preview" note: nothing is saved, sent or charged. If a pilot mistakes a preview for something live, that is on the labelling, so the labelling is part of the real-person test.

## Where things live

- Decisions: [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md), "Private pilot launch (2026-11-03)".
- Your setup list: [FOUNDER_SETUP.md](FOUNDER_SETUP.md), "Launch by 15 November".
- The exact order for 6 and 7 November (migrations, tests, settings, web, worker, browser tests, the gate check): [DEPLOY_DAY.md](DEPLOY_DAY.md).
- Every environment variable, where it goes and who creates it: [ENVIRONMENT.md](ENVIRONMENT.md).
- Worker hosting steps: [DEPLOY_WORKER.md](DEPLOY_WORKER.md). Staging app: [DEPLOY_STAGING.md](DEPLOY_STAGING.md).
- Making invite codes: in the Supabase SQL editor run `select public.create_pilot_invite('Acme', 1, 30);` (a note, how many people may use it, days it lasts). Revoke one with `update public.pilot_invites set revoked_at = now() where note = 'Acme';`.
