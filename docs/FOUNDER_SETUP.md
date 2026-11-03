# Your setup list

*Things only you can do: accounts, verifications and secrets. Each says why it matters and roughly how long it takes. Secrets always go in `.env` (never in chat). Tick them off as you go. Last updated 19 October 2026.*

## 1. Now: unblocks testing

- [ ] **Restore staging.** Supabase dashboard › project `workspace-staging` › Restore. *(2 minutes, plus a few minutes to wake up.)*
  It paused for inactivity. Until it's back, I can't apply the sending-replies and website-chat migrations or test anything for real. Free projects pause again after about a week idle. The Pro plan ($25/month) never pauses: worth it once we're testing with real users.
- [ ] **Give the Supabase CLI access.** Run `npx supabase login` in a terminal, with an account that has access to the project. *(5 minutes.)*
  The CLI currently says "no privileges", so I apply migrations through the direct database connection instead. That works, but the CLI is the cleaner route.
- [ ] **Set `NEXT_PUBLIC_SITE_URL`** in `.env` and in Vercel to the app's public address (e.g. `https://app.yourdomain.com`). *(2 minutes.)*
  The website chat install code and email links use it.
- [ ] **Run the worker and the Discord Gateway on Fly.io (decided 2 November 2026).** The worker sends replies and processes incoming messages; the Gateway keeps Discord connected. About $7.40 a month for both. *(30 minutes, once.)*
  The files are ready (`Dockerfile`, `fly.toml`) and the exact steps are in `docs/DEPLOY_WORKER.md`. Until it runs, replies stay "queued" and Discord messages are not received.

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

### Voice (needs a Twilio account and a voice-capable number; billed by Twilio)

- [ ] **A number that can take calls** in the country you'll use (it can be the same number as your SMS inbox). *(Twilio's own checks may apply to some countries.)*
- [ ] **Connect it:** Settings > Channels > Voice, paste the Account SID, Auth Token, the number, and the phone that should ring (your mobile). Press Connect.
- [ ] **Paste Relay's address into the number:** in the Twilio Console, open the number's settings, find where incoming calls are handled, choose a webhook, paste the address Relay shows, choose **HTTP POST**, save. The site's public address must be https.
- [ ] **Call the number** from another phone. Your phone should ring. Answer it: the Inbox should show an "Incoming call" card with its length.
- [ ] **Don't answer** the next call. After the ring time you should hear the greeting, the recording notice, a beep. Leave a message and hang up. The Inbox should show a "Missed call" card, then a "Voicemail" card you can play.
- [ ] **If your own phone has voicemail:** Twilio counts a call as answered when that voicemail picks up, so callers never reach Relay's. Set Seconds to ring shorter than your phone's voicemail takes, or turn that voicemail off.
- [ ] **Recording notice:** decide what your callers must be told where you are. Relay only plays the words you write.
- [ ] **Things I could not confirm from Twilio's documents, to watch for:** whether the voicemail file downloads with the Account SID and Auth Token (Twilio's page names an API key and does not mention the token; if the card says "Relay couldn't save this voicemail", tell me and I will add an API key field), whether Twilio sends the recording-ready notice when a caller hangs up in the middle of a message (the missed-call card is filed either way, but the voicemail card might not be), what Twilio sends as the caller number when it is withheld (Relay files nothing for such a call), and how the default spoken voice sounds in your language.

### Slack (needs a Slack workspace you can add apps to, plus a second workspace or a Slack Connect partner to play the customer)

Slack is different from the other channels: you create the one Relay Slack app once, and every customer clicks "Add to Slack".

- [ ] **Create the Relay Slack app** at api.slack.com/apps (a free Slack workspace is enough). Under OAuth & Permissions add the **bot scopes**: `channels:history`, `groups:history`, `chat:write`, `users:read`, `files:read`. Add the **redirect URL**: your site's public address followed by `/api/oauth/slack/callback`. *(Slack's menu names may differ slightly from what I describe; I could not check their screens.)*
- [ ] **Turn on Event Subscriptions** and set the **request URL** to your site's public address followed by `/api/webhooks/slack`. Slack checks it immediately, so the site must be running at that address. Subscribe to the bot events `message.channels`, `message.groups` and `app_uninstalled`.
- [ ] **Allow other workspaces to install it** (Manage Distribution), so customers can add it. **Check whether Slack requires a Marketplace listing for this.** I could not confirm it from Slack's pages.
- [ ] **Put three values in the server's environment** (never in chat): the **Client ID** and **Client Secret** (Basic Information), and the **Signing Secret** (Basic Information). Names: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`. Restart the server.
- [ ] **Connect:** Settings > Channels > Slack > Add to Slack, approve it in your workspace.
- [ ] **Share a channel with someone outside:** use a Slack Connect channel with a friend's workspace (or a second workspace of your own). Add the Relay app to the channel in Slack.
- [ ] **Write from the other side:** the message should appear in the Inbox as a new chat within seconds, with their name. Reply from the Inbox and check it appears in the Slack thread under their message.
- [ ] **Type a reply in Slack yourself** inside their thread: it should appear in the chat as the team's, marked "sent outside Relay".
- [ ] **Send a file** from the other side and check it appears in the chat.
- [ ] **Things I could not confirm from Slack's documents, to watch for:** whether Slack Connect is available on your plan and who on each side may add an app to the channel; whether the app receives the outside person's messages when it is installed only on your side (Slack's page says events from external users arrive, with no other conditions); whether a person from the other workspace is correctly recognised as a customer (Relay compares their workspace with yours); whether an outside person's name comes back from Slack; whether files from the other side download; the exact HTTP style Slack accepts for each call (Relay uses form posts and plain GETs); how text with `<`, `&` or @mentions in a reply is shown (Relay sends it as typed, unescaped); and whether Slack sends the app-removed notice. Tell me what you see.

### Discord (needs a Discord account and a server of your own; free)

Discord needs one extra program running all the time: the **Gateway**. Discord only delivers messages over a connection that stays open, so this cannot run on a serverless host. Run exactly one copy next to the worker with `pnpm --filter @app/worker gateway` (it uses the same `.env` as the worker). Without it, the channel page says it is waiting.

- [ ] **Start the Gateway** (above) and keep it running.
- [ ] **Make a bot:** in Discord's Developer Portal create an application, open its **Bot** page and copy the **token**. Never paste it in chat. You do not need to switch on any "intent" or permission toggle there.
- [ ] **Connect it:** Settings > Channels > Discord, paste the token, press Connect. Within a minute the channel page should say the bot is connected and show **Add the bot to a server**.
- [ ] **Add it to your server** with that link.
- [ ] **Send the bot a direct message** from a second Discord account: it should appear in the Inbox as a new chat with their name. Reply from the Inbox and check it arrives as a direct message.
- [ ] **Mention the bot in a server channel** from the second account (@YourBot hello): a separate chat should appear, and your reply should show up as a Discord reply under their message. A message in the channel that does not mention the bot should NOT appear.
- [ ] **Send a picture** to the bot and check it appears in the chat.
- [ ] **Stop the Gateway** for a minute and start it again: messages sent while it was off may be missed (see below), and the channel page should recover to connected.
- [ ] **Things I could not confirm from Discord's documents, to watch for:** whether a person who shares no server with the bot can send it a direct message at all (Relay assumes people reach it through your server); whether a mention in a server really arrives without the privileged Message Content permission (Discord's page says content is given for messages that mention the app); which closing codes Discord allows a reconnect after (Relay retries anything except the two documented ones); how long an attachment link stays valid; what Discord answers when a person has closed their direct messages (Relay shows Discord's own words); the limit on servers for a bot that is not verified; and that messages sent while the Gateway was fully stopped are not replayed (Discord replays only within one connection's session).

### Microsoft Teams (needs a Microsoft 365 / Teams account with admin rights, and an Azure account; Microsoft may charge for Azure)

This is the heaviest setup of all the channels, because Microsoft requires each company to register its own bot. To test it you play a company: use a Microsoft 365 developer or test tenant if you have one.

- [ ] **Azure:** create an **Azure Bot** (single tenant). Note its **Application (client) ID** and your **Directory (tenant) ID**. Create a **client secret** and copy its **value** at once (Azure shows it once). *(I could not confirm from Microsoft's pages whether an Azure Bot can be created for free or what subscription it needs.)*
- [ ] **Connect it:** Settings > Channels > Microsoft Teams, paste the three values, a name (for example "Help desk") and an optional welcome message, press Connect.
- [ ] **Give Microsoft the address:** on the channel page, copy the **messaging endpoint** into the Azure Bot's settings, and make sure the bot is enabled for Microsoft Teams. The site's public address must be https.
- [ ] **Upload the Teams app:** on the channel page press **Download the Teams app file**. In the Teams admin center upload it as an app for the organization (or, for a quick test, upload it yourself in Teams if custom uploads are allowed), and allow colleagues to use it.
- [ ] **Write to the bot** in Teams from a colleague's account: the message should appear in the Inbox with their name. Reply from the Inbox and check it arrives in the Teams chat.
- [ ] **Welcome message:** if you set one, a second colleague opening the bot for the first time should receive it, and no empty chat should appear in the Inbox.
- [ ] **Send a file** with the paperclip: it should appear in the chat. **Paste a picture**: it appears as an unsupported message.
- [ ] **Things I could not confirm from Microsoft's documents, to watch for:** whether Teams accepts the app file as built (the manifest version "1.30" and the file name manifest.json are my best reading, and both are single constants in `teams-package.ts`; if the upload is refused, send me Teams' message); whether the key endorsement check passes for real Teams traffic (if every message is refused, the server log says "channel not endorsed"); whether an Azure Bot may be created single-tenant for free; the maximum length of a Teams message; how a pasted picture arrives; how long the conversation address stays valid; whether a colleague can open the bot before an admin has made the app available to them; and how replies render (Relay sends plain text, and Teams may treat `*` or `_` as formatting).

### Viber (needs a Viber bot, which Viber only gives under a paid contract)

- [ ] **Get a bot:** Viber creates bots only for businesses that sign a contract with Viber or an official partner (about EUR 100 to 115 a month; Viber's own pages disagree). If you don't have one, you can't test this channel; the customer-facing screen says so.
- [ ] **Copy the bot's authentication token** from your Viber bot account settings. Never paste it in chat.
- [ ] **Connect it:** Settings > Channels > Viber, paste the token, press Connect. The site's public address must be https; Viber calls it once to check, and the connection is undone if it can't.
- [ ] **Write to the bot** from your own Viber: the message should appear in the Inbox with your name. Reply and check delivered and seen ticks appear.
- [ ] **Welcome message:** if you set one, open the bot from a second Viber account for the first time: it should arrive once, and no empty chat should appear.
- [ ] **Send a picture and a sticker:** the picture appears; the sticker shows as an unsupported message.
- [ ] **Things I could not confirm from Viber's documents, to watch for:** whether Viber's check call (when Relay sets the webhook) carries a signature (Relay accepts that one call without it); whether the signature header is hex or base64 (Relay accepts both); whether the 24-hour session rule limits sending (Relay does not block, Viber may charge); how pictures and files arrive (links last one hour); what Viber says to a reply to a person who has unsubscribed; and the current fee.

### X / Twitter (needs an X developer account with credits; X bills about $0.010 per message received and $0.015 per reply)

This is the least certain channel: several X pages describe pieces of it and I had to join them. Test with an account you can lose time on.

- [ ] **X developer app:** in the X Developer Console create an app of a type that has a **Client Secret** (a Web App), and buy some credits. Copy its **Client ID**, **Client Secret** and **Bearer Token**.
- [ ] **Callback address:** in the app's settings, add the callback address shown on Relay's X connect page exactly as shown.
- [ ] **Connect it:** Settings > Channels > X, paste the three values, press Connect. X asks you to log in as the account that should answer; approve. You land back on the channel page, which should say "Connected as @name".
- [ ] **Send the account a direct message** from another X account: it should appear in the Inbox within seconds. Reply from the Inbox and check it arrives on X.
- [ ] **Leave it two hours** and reply again: the login should renew by itself.
- [ ] **Things I could not confirm from X's documents, to watch for:** the exact shape of the event X posts to the webhook (Relay searches the body for the direct-message events rather than relying on a fixed layout); whether the app-only Bearer Token is accepted to register the webhook, and the account's own token to create the subscription; whether X's Account Activity or X Activity API is what your developer plan includes for DMs; the response fields of the login token call (Relay reads access_token, refresh_token, expires_in); whether the refresh token can only be used once (Relay saves the new one each time, but two replies sent at the exact same moment could race); what X answers when the person doesn't accept messages from your account; the text length limit; how a message from a person with encrypted chats behaves; what X answers when credits run out (Relay shows X's own words). If registering the webhook fails, the channel page says so; tell me X's wording.

### TikTok, WeChat and Apple Messages (no setup possible yet)

- [ ] **Look at each Request access page** (Settings > Channels > the channel). Check the words are clear to someone who has never heard of the platform, press **Request access** with a note, and check it says when you asked.
- [ ] **Read the requests** in the database when you want to know what customers want next: the table is `channel_access_requests` (workspace, channel, note, who, when).
- [ ] **TikTok, if you want to pursue it:** apply for Business Messaging API access for Relay's app in TikTok's developer portal, including the data security and privacy reviews. It is a company task and the timeline is unknown.

Per-channel checklists (what to open and press to see a real message arrive) are added here as each channel is built.

### Deals and tasks (needs staging awake with migrations 20261103000001 and 20261103000002 applied; costs nothing)
- [ ] As the owner: Settings › Currency, pick a currency, open Deals and check the amounts show in it.
- [ ] As an agent: make a deal for a customer (from the Deals page and from the customer's page), move it New → Quoted → Negotiating.
- [ ] As the same agent: "Ask for a discount" 10%. As the owner or sales manager: approve it; the deal value should drop by 10%.
- [ ] Mark a deal Won (it must ask for a final value) and another Lost (it must ask for a reason); then Reopen one.
- [ ] As a support manager or viewer: confirm you cannot see deal amounts (or the board at all for the viewer).
- [ ] Add a task with "Every week", tick it done: the next one should appear a week later; press Undo and the new one should disappear.
- [ ] Snooze a task, add a note to a task.
- [ ] Erase a test customer who has a deal and a task: both should disappear.

### Notifications and Home (needs staging awake with migration 20261104000001 applied; costs nothing)
- [ ] As an agent: ask for a discount on a deal. As the owner (other browser or window): the bell should show "asks for 10% off ..." without reloading the page, and Home should list it under Needs you now.
- [ ] As the owner: approve it. As the agent: the bell tells you the answer. The owner's own "asks" notice should stop showing as new.
- [ ] Press "Mark all as read", reload the page: they should stay read.
- [ ] As a manager: give an agent a task. The agent's bell should say so. Add a task due a few minutes from now, wait for the time to pass plus five minutes: "Late: ..." should appear in the bell and on Home.
- [ ] Hand a chat to someone, and write an @mention in a note to someone who can and someone who cannot see the chat: only the first should hear.
- [ ] Open Home as each role (owner, sales manager, support manager, agent, viewer): the numbers should make sense for the role, there should be no made-up figures, and roles that cannot see deal values should see no money.
- [ ] A brand-new test workspace should still show the setup checklist until its first chat, deal or task.

### Reports (needs staging awake with migration 20261105000001 applied; costs nothing)
- [ ] As the owner: open Reports. You should see Conversations, Team and Sales (no Satisfaction), no "Sample numbers" label, and the note about clock time.
- [ ] Compare the numbers with what you know: reply to a test chat from the inbox, then check "Usually answered in" moves; resolve it and check "Resolved" and "Usually finished in".
- [ ] Have the same test customer write again after you resolved the chat: Reports should count a second chat.
- [ ] Change the time range, the team and the channel: the page should reload with new numbers and keep your choices in the address.
- [ ] As a sales or support manager: only your own teams' chats should be counted, and the team filter should list only your teams.
- [ ] As an agent: no Reports link, and the address shows "not found".
- [ ] As a role without deal values: the Sales tab shows counts, not money, and says why.
- [ ] Press "Export CSV" on each tab and open the file.
- [ ] Imported history chats (if any) should not change the numbers.

### Reply targets (needs staging awake with migration 20261106000001 applied and the worker running; costs nothing)
- [ ] As the owner, open Settings > Reply targets. Each team should show Monday to Friday 9 to 17. Change one team (for example open all week with "All day") and press Save hours; reload: it should still be there.
- [ ] Add a closed day for tomorrow. Try to add another that overlaps it: it should be refused with a plain message. Remove the first.
- [ ] Add a rule: first reply within 5 minutes. With a test customer, write in on a channel that team uses. The chat in the inbox should say "Answer due in ..." and count down; at about 4 minutes it turns amber, at 5 red ("late by").
- [ ] Reply from the inbox: the flag should go away. Do the same with a reply typed on the business's phone app (WhatsApp Business) or in Slack/Discord/Teams, if you have those connected: they should stop it too.
- [ ] Close the team for the whole day (or set the closed-day list to include today) and have a customer write in: the clock should not move.
- [ ] Resolve the chat, then write again as the customer: a new chat starts, with a fresh clock.
- [ ] After the chat has been late for a few minutes (the sweep runs every five minutes): the person holding it should get a bell notice at the warning and another when it is late; the owner and the team's manager should hear when it is late; a chat nobody holds should tell the people on that team and the managers. Answering the chat should clear the notice.
- [ ] Turn off "Tell the team's managers when a chat is late": only the holder should hear about the next one.
- [ ] As a sales or support manager: you can change your own team's hours and rules that name only your teams, not other teams' or rules for every team, and not the alert settings. As an agent or viewer: the screen is read-only.
- [ ] Open Reports: "Within reply target" should appear next to "Open now" once some chats have a first-reply rule, and match what you saw in the inbox.
- [ ] Open Home as a support manager: "Over target" should show a number, and late chats should appear under "Needs you now".
- [ ] Check the workspace's time zone is right (the owner sees it under the opening hours): clocks follow it.

## 6. Before launch

- [ ] **Run the real-person test** from [docs/SIMPLICITY_AUDIT.md](SIMPLICITY_AUDIT.md): 3–5 people who've never seen Relay. *(2 hours.)*
- [ ] **Lock pricing** (currently provisional at $19 / $39 / $79). Note that Chatwoot charges the same $19 / $39.
- [ ] **Create a Stripe account** for billing (trials, per-user checkout, invoices). *(30 minutes, plus their review.)*
- [ ] **Have a lawyer read the privacy policy, terms and DPA**, especially for EU customers. *(1–2 weeks.)*
- [ ] **Set up error monitoring.** Create a Sentry account and put the DSN in `.env`. *(15 minutes.)*
- [ ] **Paperwork** from the earliest plan (company licence, business email). Confirm what's still needed now that Relay is a global product.
- [ ] **Decide about the investor document.** It's in `docs/investor/`, not committed. Commit it to the repo, or keep it out?
