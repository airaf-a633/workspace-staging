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
  - Add the delegated permissions `Mail.ReadWrite.Shared` and `Mail.Send.Shared` as well, for shared mailboxes like support@.
  - Create a **client secret**. Put the Application (client) ID and the secret in `.env` as `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET`, for both the app and the worker.
  - Set `APP_URL` in the worker's settings to the app's public address. Microsoft sends new-mail notifications to `APP_URL/api/webhooks/microsoft`, which Relay sets up by itself.
  - Client secrets expire (at most 2 years). Put the expiry date in your calendar.
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
  - Put the ID and secret in `.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, for both the app and the worker.
  - On the consent screen, add the scopes `openid`, `email`, `gmail.modify` and `gmail.send`.
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

## 7. Testing the new channels (after staging is back)

Nothing in the channel work has run against a real server yet. Once staging is restored, in this order:

- [ ] **Apply the waiting database changes** (I do this; it needs `SUPABASE_DB_URL` in `.env`). Ten are waiting, plus `20261020000009_export` and `20261101000001_channel_foundation`.
- [ ] **Start the worker** in a terminal: `pnpm --filter @app/worker dev`. Replies, files and incoming channel messages are all handled by it.
- [ ] **Run the live browser tests** (PowerShell): `$env:E2E_LIVE=1; $env:E2E_WORKER=1; pnpm --filter @app/web e2e:live`.
- [ ] **API channel, by hand:** Settings > Channels > API > Create inbox, copy the key, then run the `curl` example it shows. The message should appear in the Inbox within a few seconds.

### Telegram (needs your Telegram account; free, about 10 minutes)

- [ ] **Make a test bot:** in Telegram, chat with @BotFather, send `/newbot`, follow the steps, and copy the token. *(5 minutes.)* Keep the token in your password manager. Never paste it in chat.
- [ ] **Make sure the app has a public https address.** Telegram only sends messages to a secure public address, so a local `http://localhost` setup can't connect a bot. Use the staging site's address in `NEXT_PUBLIC_SITE_URL`.
- [ ] **Connect it:** Settings > Channels > Telegram, paste the token, press Connect. The page then shows the bot's link and a "Connection" line from Telegram itself.
- [ ] **Send it a message** from your own Telegram (open the link, press Start, write something). It should appear in the Inbox within a few seconds. Reply from the Inbox and check it arrives in Telegram.
- [ ] **Things I could not confirm from Telegram's documents, to watch for:** what the exact error is when a person blocks the bot, and whether a bot can ever message someone who hasn't pressed Start. Tell me what you see; I'll word the screens on facts.

### LINE (needs a LINE account; free to set up, about 20 minutes)

- [ ] **Create a LINE Official Account** (LINE Official Account Manager) and turn on the **Messaging API** for it. You'll pick a *provider*; LINE says it can't be changed afterwards. *(10 minutes.)*
- [ ] **Copy two values** from the LINE Developers Console: the **Channel secret** (Basic settings tab) and a **Channel access token (long-lived)** (Messaging API tab, press Issue). Keep them in your password manager. Never paste them in chat.
- [ ] **Connect it:** Settings > Channels > LINE, paste both, press Connect.
- [ ] **Paste Relay's address into LINE:** Messaging API tab > Webhook URL > Edit > paste > Update > **Verify** (should say Success) > turn on **Use webhook**. The site's public address must be https.
- [ ] **Turn off LINE's own replies:** in LINE Official Account Manager, turn off **Greeting message** and **Auto-reply messages** (both are on by default), or customers get two replies.
- [ ] **Send a message** to your account from your own LINE app. It should appear in the Inbox within a few seconds with your LINE name. Reply from the Inbox and check it arrives in LINE.
- [ ] **Reply timing, to watch for:** a reply within about a minute is free; a later one is a push message that counts against the plan's monthly allowance. Check LINE Official Account Manager's message count before and after to confirm which kind each reply was.
- [ ] **Things I could not confirm from LINE's documents, to watch for:** the exact error text when the monthly allowance is used up, the shape of the profile answer (does your name show up?), and whether blocking the account shows the "blocked your account" line in the chat. Tell me what you see.

### SMS (needs a Twilio account and a phone number; billed by Twilio)

- [ ] **Twilio account and a number:** create a Twilio account and buy or use a number that can send and receive texts in the country you'll use. A trial account can only text numbers you've verified in Twilio. *(15 minutes, plus Twilio's own checks.)*
- [ ] **Copy two values** from the Twilio Console dashboard: the **Account SID** (starts with AC) and the **Auth Token**. Keep them in your password manager. Never paste them in chat.
- [ ] **Connect it:** Settings > Channels > SMS, paste both and the number, press Connect.
- [ ] **Paste Relay's address into the number:** in the Twilio Console, open the number's settings, find where incoming messages are handled, choose a webhook, paste the address Relay shows, choose **HTTP POST**, save. The site's public address must be https.
- [ ] **Text the number** from your own phone. It should appear in the Inbox within a few seconds. Reply from the Inbox and check it arrives, and that the message shows delivered (ticks) a moment later.
- [ ] **US numbers:** Twilio may need business registration (A2P 10DLC) or a verified toll-free number before US texts are delivered. The Twilio Console shows what your number needs. I did not quote Twilio's fees because its own pages disagree.
- [ ] **Try STOP:** text STOP from your phone. Twilio replies for you; Relay should show "replied STOP" in the chat and mark you opted out of text marketing. Then text START and check the chat says so.
- [ ] **Things I could not confirm from Twilio's documents, to watch for:** whether an empty reply to Twilio is accepted without complaint, whether a picture's link needs the account's login to download, how fast delivery reports arrive, and whether Relay's account check (fetching your Twilio account) works for every account type, such as sub-accounts. Tell me what you see.

Per-channel checklists (what to open and press to see a real message arrive) are added here as each channel is built.

## 6. Before launch

- [ ] **Run the real-person test** from [docs/SIMPLICITY_AUDIT.md](SIMPLICITY_AUDIT.md): 3–5 people who've never seen Relay. *(2 hours.)*
- [ ] **Lock pricing** (currently provisional at $19 / $39 / $79). Note that Chatwoot charges the same $19 / $39.
- [ ] **Create a Stripe account** for billing (trials, per-user checkout, invoices). *(30 minutes, plus their review.)*
- [ ] **Have a lawyer read the privacy policy, terms and DPA**, especially for EU customers. *(1–2 weeks.)*
- [ ] **Set up error monitoring.** Create a Sentry account and put the DSN in `.env`. *(15 minutes.)*
- [ ] **Paperwork** from the earliest plan (company licence, business email). Confirm what's still needed now that Relay is a global product.
- [ ] **Decide about the investor document.** It's in `docs/investor/`, not committed. Commit it to the repo, or keep it out?
