# Environment variables: what goes where for the pilot

*Written 3 November 2026 from the code (`apps/web/src/env.ts`, `apps/web/src/lib/public-env.ts`, `apps/worker/src/env.ts`, `fly.toml`, `.env.example`). Secrets go in `.env` on your machine, in **Vercel** (the web app) and in **Fly.io secrets** (the worker). Never in chat, never in the repository.*

## The web app (Vercel, Production and Preview)

| Variable | Needed for | Where it comes from |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Everything | Supabase › Connect (the project URL) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Everything | Supabase › Connect (the "anon" or publishable key). Safe in the browser. |
| `SUPABASE_SERVICE_ROLE_KEY` | Everything on the server | Supabase › Connect (the "service_role" key). **Secret.** It bypasses the security rules. |
| `NEXT_PUBLIC_SITE_URL` | Sign-in and sign-up emails, invitation links, channel webhooks | The app's public address, e.g. `https://app.yourdomain.com`, no trailing slash. **Required in production:** if it is missing, sign-up and invitations stop with an error instead of sending people links to localhost (changed 3 November). |
| `INBOUND_EMAIL_DOMAIN` | Email channel | The domain you point at Postmark's inbound (e.g. `in.yourdomain.com`) |
| `POSTMARK_INBOUND_USER`, `POSTMARK_INBOUND_PASSWORD` | Email channel | You choose them: 16 or more random characters each. They go in Postmark's inbound webhook URL. |
| `POSTMARK_ACCOUNT_TOKEN` | Optional: businesses verify their own sending domain | Postmark › Account API tokens |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | Slack (on for the pilot, decided 5 November) | The one Relay Slack app at api.slack.com/apps, Basic Information. **Secrets.** Web app only. Steps: [PLATFORM_CONNECTIONS.md](PLATFORM_CONNECTIONS.md) |
| `SENTRY_DSN` | Optional | Not used by the code yet (error monitoring is not wired). |

**Must not be set** on the pilot deployment: `SITE_MODE` and `PREVIEW_PASSWORD`. With `SITE_MODE=preview` the real app, sign-in and webhooks are switched off.

## The worker and the Discord Gateway (Fly.io secrets, `fly secrets set NAME=value`)

| Variable | Needed for | Where it comes from |
|---|---|---|
| `SUPABASE_URL` | Everything | The same value as `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | Everything | The same value as in Vercel. **Secret.** |
| `INBOUND_EMAIL_DOMAIN` | Email channel | The same value as in Vercel |
| `POSTMARK_SERVER_TOKEN` | Email replies | Postmark › your Server › API tokens. **Secret.** |
| `EMAIL_SEND_DOMAIN` | Email replies | The sending domain you verified in Postmark (e.g. `mail.yourdomain.com`) |
| `WHATSAPP_API_VERSION` | Not needed for the pilot | Already set to `v25.0` in `fly.toml` |

## On your machine only

| Variable | Needed for |
|---|---|
| `SUPABASE_DB_URL` | `node scripts/db-apply-remote.mjs` and `pnpm db:test:staging`. Supabase › Connect › Session pooler, with your database password. |

## Per business, not an environment variable

Telegram bot tokens, LINE channel secrets and tokens, and Discord bot tokens are pasted by each business in Settings › Channels and kept in Supabase's Vault; Telegram and Discord register their webhooks from `NEXT_PUBLIC_SITE_URL`, and the LINE channel page shows the address to paste into LINE's console, built from it too. So the five day-one channels need nothing from this list beyond the rows above (website chat needs nothing at all; email needs the Postmark rows).

## Not needed until after the pilot launch

`META_*` (WhatsApp, Instagram, Messenger), `MICROSOFT_*` (Outlook), `GOOGLE_*` (Gmail), `STRIPE_*`, `NANGO_SECRET_KEY`, and `ANTHROPIC_API_KEY` (nothing in the code reads it yet).

## Supabase settings that are not variables

- **Authentication › URL Configuration:** Site URL = the app's address; add `https://YOUR-APP/auth/callback` to the Redirect URLs.
- **Authentication › Emails › SMTP settings:** your own SMTP (Postmark). Without it, no pilot receives a sign-up or sign-in email (Supabase's built-in service sends 2 an hour, only to your own team).
- **Authentication › Sign In / Providers:** email sign-up on; "Confirm email" on.
