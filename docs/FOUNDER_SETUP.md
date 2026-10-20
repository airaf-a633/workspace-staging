# Your setup list

*Things only you can do: accounts, verifications and secrets. Each says why it matters and roughly how long it takes. Secrets always go in `.env` (never in chat). Tick them off as you go. Last updated 19 October 2026.*

## 1. Now: unblocks testing

- [ ] **Restore staging.** Supabase dashboard › project `workspace-staging` › Restore. *(2 minutes, plus a few minutes to wake up.)*
  It paused for inactivity. Until it's back, I can't apply the sending-replies and website-chat migrations or test anything for real. Free projects pause again after about a week idle. The Pro plan ($25/month) never pauses: worth it once we're testing with real users.
- [ ] **Give the Supabase CLI access.** Run `npx supabase login` in a terminal, with an account that has access to the project. *(5 minutes.)*
  The CLI currently says "no privileges", so I apply migrations through the direct database connection instead. That works, but the CLI is the cleaner route.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** in `.env` and in Vercel to the app's public address (e.g. `https://app.yourdomain.com`). *(2 minutes.)*
  The website chat install code and email links use it.
- [ ] **Decide where the worker runs.** It's the background process that sends replies and processes webhooks. *(30 minutes.)*
  Earlier we planned Fly.io. It needs the same Supabase URL and service key as `.env`. Until it runs somewhere, replies stay "queued".

## 2. Email: Postmark plus a forwarding domain

Needed for the email channel I'm building next.

- [ ] **Create a Postmark account** (postmarkapp.com) and a **Server** named "Relay". *(10 minutes.)*
  - Put the **Server API token** in `.env` as `POSTMARK_SERVER_TOKEN`.
  - Postmark reviews new accounts before they can send to anyone. Reply to their approval email with what Relay is. *(Usually 1 business day.)*
- [ ] **Pick and buy Relay's own domain**, if you haven't (e.g. `relayinbox.com`). *(15 minutes.)*
- [ ] **Add a sending domain in Postmark** (e.g. `mail.yourdomain.com`), and add the DKIM and Return-Path DNS records it shows you. *(15 minutes, plus up to a few hours for DNS.)*
  Then set `EMAIL_SEND_DOMAIN` to it in the worker's settings. Replies come from addresses on it until a business verifies its own domain.
- [ ] **Copy Postmark's Account API token** (Account › API Tokens; not the server token) into the app's `.env` as `POSTMARK_ACCOUNT_TOKEN`. It lets businesses verify their own domains from Settings, so replies come from their address. *(2 minutes.)*
- [ ] **Set up the inbound domain** (e.g. `in.yourdomain.com`). *(20 minutes.)*
  - Add an MX record pointing to `inbound.postmarkapp.com`.
  - In Postmark › Server › Inbound, set the domain and this webhook URL, with the username and password from the next step: `https://USER:PASSWORD@YOUR-APP/api/webhooks/postmark`.
  - Each workspace then gets an address like `northwind@in.yourdomain.com`, and businesses forward their support address to it.
- [ ] **Set the inbound webhook password.** Choose a long random username and password (16+ characters each) for the webhook URL, and put them in `.env` as `POSTMARK_INBOUND_USER` and `POSTMARK_INBOUND_PASSWORD`. Also set `INBOUND_EMAIL_DOMAIN` (e.g. `in.yourdomain.com`) in both the app's and the worker's settings. *(2 minutes.)*

## 3. "Continue with Outlook" (Microsoft)

- [ ] **Register an app.** Azure portal › Microsoft Entra ID › App registrations › New. *(20 minutes.)*
  - **Supported account types:** "Accounts in any organizational directory and personal Microsoft accounts".
  - **Redirect URI** (Web): `https://YOUR-APP/api/oauth/microsoft/callback`, plus `http://localhost:3000/api/oauth/microsoft/callback` for development.
  - **API permissions** (Microsoft Graph, delegated): `Mail.ReadWrite`, `Mail.Send`, `offline_access`, `User.Read`.
  - Create a **client secret**. Put the Application (client) ID and the secret in `.env` as `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`.
- [ ] **Publisher verification.** *(1–3 days.)*
  - Join the free Microsoft AI Cloud Partner Program to get a Partner ID.
  - Link that ID to the app (App registration › Branding & properties).
  - Without this, other companies see "unverified" and many company admins block it.

## 4. "Continue with Google" (Gmail)

- [ ] **Create a Google Cloud project** "Relay", and enable the **Gmail API**. *(10 minutes.)*
- [ ] **Set up the OAuth consent screen** as External, with app name, logo, support email, and your domain's privacy and terms pages. *(20 minutes.)*
  - **Scopes:** `gmail.modify` (read and label) and `gmail.send`.
  - Add yourself and pilot customers as **test users** (up to 100).
- [ ] **Create an OAuth client** (Web application). *(10 minutes.)*
  - **Redirect URI:** `https://YOUR-APP/api/oauth/google/callback`, plus localhost.
  - Put the ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- [ ] **Submit for verification** when ready to go beyond 100 test users. *(Several weeks, plus a yearly cost.)*
  - Gmail scopes are "restricted", so Google requires a **CASA security assessment** by an approved lab. Expect roughly $500–$4,500 a year, depending on the lab and tier.
  - Until then: test users only, behind an "unverified app" warning. Fine for pilots.

## 5. WhatsApp, Instagram and Messenger (Meta)

The longest lead time. Start the verification early even if we build other things first.

- [ ] **Meta Business verification.** Business Settings › Security Center › Start verification, with company documents. *(A few days to 2 weeks.)*
- [ ] **Create a Meta developer app** (developers.facebook.com, type "Business"), and add the **WhatsApp** product. *(20 minutes.)*
  - Put the App ID and App Secret in `.env` as `META_APP_ID` and `META_APP_SECRET`.
  - Choose a random **webhook verify token** and put it in `.env` as `META_WEBHOOK_VERIFY_TOKEN`.
- [ ] **Connect the test number on staging.** *(10 minutes, once staging is back.)*
  - In the app's WhatsApp › API Setup, Meta gives a free test number and a temporary token (valid 24 hours).
  - In Relay, open Settings › Channels › WhatsApp and paste the phone number ID, WABA ID and token. I never see the token.
  - Add your own phone as a test recipient, then send a reply from the inbox to your phone.
- [ ] **Set the webhook** in the app: `https://YOUR-APP/api/webhooks/whatsapp`, with the verify token above. Subscribe to `messages`. *(5 minutes.)*
- [ ] **Create a System User and a permanent token** (Business Settings › System users). Temporary tokens expire after 24 hours. *(15 minutes.)*
- [ ] **App Review** for `whatsapp_business_messaging` and `whatsapp_business_management`, and later Instagram and Messenger. *(1–3 weeks.)*
  - Needs a screen recording of Relay in use. I'll script it with you.
- [ ] **Become a Tech Provider and set up Embedded Signup**, so customers connect their own numbers in a few clicks. *(Weeks; after App Review.)*

## 6. Before launch

- [ ] **Run the real-person test** from [docs/SIMPLICITY_AUDIT.md](SIMPLICITY_AUDIT.md): 3–5 people who've never seen Relay. *(2 hours.)*
- [ ] **Lock pricing** (currently provisional at $19 / $39 / $79). Note that Chatwoot charges the same $19 / $39.
- [ ] **Create a Stripe account** for billing (trials, per-user checkout, invoices). *(30 minutes, plus their review.)*
- [ ] **Have a lawyer read the privacy policy, terms and DPA**, especially for EU customers. *(1–2 weeks.)*
- [ ] **Set up error monitoring.** Create a Sentry account and put the DSN in `.env`. *(15 minutes.)*
- [ ] **Paperwork** from the earliest plan (company licence, business email). Confirm what's still needed now that Relay is a global product.
- [ ] **Decide about the investor document.** It's in `docs/investor/`, not committed. Commit it to the repo, or keep it out?
