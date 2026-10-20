# Staging: the real app, for testing WhatsApp

Decided 2026-10-02. A second Vercel project runs the **real app** from the same repository, with sign-in, the staging database and the WhatsApp webhook. Meta sends test-number messages here. The partner preview stays separate and password-protected.

| | Partner preview | Staging |
|---|---|---|
| Vercel project | `workspace-staging` (existing) | a new one, e.g. `workspace-app-staging` |
| `SITE_MODE` | `preview` | not set (the real app) |
| Database keys | none | staging Supabase only |
| Who uses it | your partner | you and me, for testing |

## 1. Create the Vercel project (about 10 minutes)

1. On vercel.com: **Add New → Project → Import** the same repository again. Give it a different name, e.g. `workspace-app-staging`.
2. **Root Directory:** `apps/web`, with "Include files outside the root directory" on. Framework: Next.js. Node 22 or newer.
3. **Environment Variables** (Production and Preview). Copy each value from your `.env`; never paste them in chat.

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from `.env` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from `.env` |
   | `SUPABASE_SERVICE_ROLE_KEY` | from `.env` |
   | `NEXT_PUBLIC_SITE_URL` | this project's address, e.g. `https://workspace-app-staging.vercel.app` |
   | `META_APP_SECRET` | from `.env` |
   | `META_WEBHOOK_VERIFY_TOKEN` | from `.env` |
   | `WHATSAPP_API_VERSION` | `v25.0` |

   Don't set `SITE_MODE` here.
4. **Deploy.** Then go to **Settings → Environments → Production → Branch Tracking** and set it to `ui/design-foundations` (until that branch is merged).
5. **Supabase:** go to Authentication → URL Configuration and add `https://<staging-address>/auth/callback` to the Redirect URLs, so sign-in links work there.

## 2. Meta test number

1. In [Meta for Developers](https://developers.facebook.com/apps), open the app, then **WhatsApp → API Setup**.
2. Add your own phone under "To" as a test recipient. Meta allows up to 5.
3. Put the **App ID** in `.env` as `META_APP_ID` (it's empty now).
4. **WhatsApp → Configuration → Webhook:**
   - Callback URL: `https://<staging-address>/api/webhooks/whatsapp`
   - Verify token: the same value as `META_WEBHOOK_VERIFY_TOKEN`
   - Press **Verify and save**, then subscribe to the **messages** field.
5. Sign in to staging as the owner, go to **Settings → WhatsApp numbers → Connect Meta's test number**, and paste the Phone number ID, the WhatsApp Business Account ID and the access token from API Setup.
   - The temporary token expires after 24 hours.
   - For longer tests, create a System User token in Business Settings with `whatsapp_business_messaging` and `whatsapp_business_management`.

## 3. Run the worker (on your laptop for now)

```bash
pnpm worker
```

It processes the stored webhooks and downloads media. Leave it running while you test. Messages that arrive while it's off wait in the queue and are processed when it starts.

## 4. Test

Send a WhatsApp message from your phone to the test number. Within a few seconds it shows in **Inbox** on staging without reloading. Also try a photo, a voice note, a location and a reaction.

## Checks without Meta

```bash
apps/worker/node_modules/.bin/tsx scripts/m2-smoke.mts
```

This runs a full receive cycle on staging with a stand-in number, then deletes what it created.
