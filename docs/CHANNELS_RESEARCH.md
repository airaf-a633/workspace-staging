# The other 13 channels: research

*Researched 1 November 2026, from the platforms' own docs where I could open them and from vendor and community sources where I couldn't. Each claim is marked **[official]**, **[vendor]** (a company that sells to this market, so it may be selling) or **[unverified]** (sources disagree or I found one source only). Anything marked unverified gets confirmed at sign-up time, before we depend on it.*

## At a glance

| Channel | Access | Who can use it | Real cost | How messages arrive | Reply rule | Build risk |
|---|---|---|---|---|---|---|
| API | Ours | Anyone | None | Customer's system posts to us | None | Low |
| Telegram | Self-serve (BotFather) | Anyone | Free | Webhook | Customer must message first; no time limit | Low |
| LINE | Self-serve (LINE Developers) | Anyone | Free plan; pushes are billed past a small quota | Webhook | Replies are free and need a one-time token; pushes are billed | Low |
| SMS | Twilio account + number | Anyone (US needs carrier registration) | Per message, plus registration fees | Webhook | None, but carriers require opt-in/opt-out | Medium (rules, not code) |
| Voice | Twilio account + number | Anyone | Per minute | Webhooks | Recording rules by country | Medium |
| Slack | App install per workspace | Anyone | Free | Events API (HTTP) | Replies in threads | Medium |
| Discord | Bot token | Anyone | Free | Gateway (always-on connection) | Only people who share a server with the bot | Medium (needs an always-on process) |
| Teams | Azure bot + admin consent | Mostly a customer's own staff | Free to low | Bot Framework webhook | Bot needs a saved conversation first | High (rules changing) |
| TikTok | Our app needs TikTok's approval | TikTok Business Accounts, not EEA/CH/UK | Free | Webhook | 48 hours; text or one image | High (approval) |
| X | Developer account, pay-per-use | Anyone with a developer app | Per request, rate unclear | Webhook (reported unreliable) | Not stated | High (cost, reliability) |
| Viber | Commercial agreement | Businesses with a Viber contract | Monthly minimum plus per message | Webhook | 24-hour session | High (contract) |
| WeChat | Official Account, verification | Businesses with a Service Account | Verification fee | XML webhook | 48 hours, 5 messages | High (account rules) |
| Apple Messages | Apple-approved provider only | Registered businesses | Provider fees | Provider's API | Customer starts | Highest (Apple gate) |

## One by one

### API (our own channel)
Nothing to research externally: it's ours. A developer gets a key per inbox and can push inbound messages to us and receive our replies on a webhook of theirs. It covers every channel we don't build, like Zapier, custom apps, in-app chat and game chat. It also lets us test the whole pipeline without any third party.

### Telegram
- Self-serve: the business makes a bot with @BotFather and gets a token. Free. **[official]**
- We register a webhook per bot. Telegram sends a secret header (`X-Telegram-Bot-Api-Secret-Token`) we can check, 1 to 256 characters. Webhook ports: 443, 80, 88 or 8443. **[official]**
- A bot can't message someone first. The person has to open the bot, usually from a `t.me/<bot>` link, so the install snippet is a link and a QR code. **[official]**
- Messages come as a `chat_id`; a username is optional and there's no phone number. So Telegram people are matched only by that id, and can be merged with other channels by a person.
- **Telegram Business** is a second route: a business using Telegram Business can connect a bot to its own account, so the bot answers from the business's own chats (`business_connection`, `business_message` updates). Worth supporting as an option later. **[official]**
- Files: the normal hosted API limits downloads and uploads (20 MB down, 50 MB up, from my own knowledge; the page I read cut off before this, so confirm). A self-hosted Bot API server lifts them. **[unverified]**

### LINE
- Self-serve: create a LINE Official Account, enable the Messaging API, copy the channel secret and a channel access token. **[official]**
- Webhook requests carry an `x-line-signature` (HMAC-SHA256 of the body with the channel secret). **[official, from my knowledge of the docs; confirm while building]**
- Replies use a single-use reply token that expires within seconds. Reply messages aren't counted against the plan's message quota; push messages are. The free plan includes a small monthly push quota that depends on the country (200 in Japan). **[official pricing page and vendor posts]**
- Messages are counted per person messaged, not per bubble. **[official, May 2026]**
- A person must add the account as a friend first. We see an opaque user ID, no phone number.
- Plans and prices differ by country, so we should show "check your LINE plan" and never promise a price.

### SMS (Twilio first)
- Twilio is the sensible first provider: best docs, works in most countries, the customer keeps their own account. Others (Vonage, Sinch, MessageBird, Telnyx) can come later behind the same adapter.
- Inbound messages and delivery receipts arrive as webhooks, signed with `X-Twilio-Signature`.
- **The hard part is rules, not code.** In the US, texting from a normal number needs A2P 10DLC registration (a brand and a campaign), or a verified toll-free number. Twilio lists a one-time brand fee ($4 to $44 depending on type), a campaign vetting fee ($15, though one source says $40) and a monthly campaign fee ($1.50 to $10). Approval is days. **[official page, with conflicting numbers: treat as unverified]**
- Other countries have their own sender rules (UK/EU sender IDs, India DLT, and so on).
- STOP and START replies must be honoured. Twilio blocks sends to people who texted STOP; we also need to record that as "opted out" in our consent list, so campaigns don't try again.
- Cost per message depends on country; long texts split into segments (160 characters in GSM, 70 with emoji or other scripts). MMS images are US and Canada only.

### Voice (Twilio Voice)
- We decided earlier that Voice means call logs. The realistic first version: each call (in or out) becomes a conversation entry with time, length, who answered, a recording link and a transcript. Missed calls and voicemails land in the inbox.
- US pricing from vendor sources: about $0.0085 a minute inbound, about $0.013 to $0.014 outbound, recording $0.0025 a minute, transcription $0.024 to $0.05 a minute. **[vendor / partly official]**
- Calling from the browser (a softphone) is a second, bigger step using Twilio's Voice SDK. Leave it for later.
- Recording laws differ (several US states and many countries need everyone's consent). The setup must offer a spoken notice, off by default for recording.
- Voice shares the Twilio connection with SMS, so one connect screen, two inboxes.

### Slack
- Events API over HTTP with request signing, OAuth install per workspace. **[official, my knowledge]**
- **Two different products hide in "Slack":**
  1. *Customers in Slack Connect channels*: an external customer is in a shared channel and the support team answers there. This is the real "customer channel" use, popular with B2B and developer companies.
  2. *Internal help desk*: employees message a bot ("IT help") and the team handles it as tickets.
- Slack changed rate limits: for commercial apps not in the Slack Marketplace, `conversations.history` and `conversations.replies` dropped to 1 request a minute (15 messages per request) for new installs from May 2025 and existing ones from March 2026. So we must not backfill history; we rely on pushed events. **[official changelog, dates garbled in what I could read]**
- A Marketplace listing (Slack's review) restores normal limits and is expected before we distribute widely.
- Threads map well to conversations: `thread_ts` becomes our thread key.

### Discord
- **Direct messages need a gateway connection**: a long-lived WebSocket with heartbeats, resuming and an identify limit of 1,000 a day. An HTTP interactions endpoint can't receive DMs. **[official gateway docs]**
- `DIRECT_MESSAGES` is a normal intent and needs no approval. DM text arrives even without the privileged `MESSAGE_CONTENT` intent, which matters only for reading server channels. **[official]**
- DM events go only to shard 0. Apps in 2,500+ servers must shard; apps in 100+ servers must be verified. **[official]**
- A bot can only DM people who share a server with it, and they can turn bot DMs off. So a Discord support inbox realistically means: a support server with a "help" channel (each question becomes a thread/conversation) plus DMs.
- This is the first channel that needs an always-on process, not just webhooks. It forces the "where does the worker run" decision (it can't be serverless).

### Microsoft Teams
- Bots use Azure Bot Service. Microsoft stopped allowing new multi-tenant bots after 31 July 2025; new bots must be single-tenant or use a managed identity. Cross-company use then depends on how the Teams app is distributed and on admin consent in each company. **[official docs; community threads]**
- Outside people chatting 1:1 with a bot across companies is not clearly supported, and I found no source confirming it. **[unverified]**
- A bot can only message someone after they've messaged it once (it needs a saved conversation reference).
- Realistic scope: an internal help desk inside one company's Teams, installed by that company's admin. Not a general "customers on Teams" channel.

### TikTok
- Business Messaging API, behind app review. The review asks for a use case, a data-handling description and company details; Chatwoot says approval takes "a few days but can take longer". A separate US data-security review applies to US accounts. **[official + vendor]**
- Works only with TikTok Business Accounts, and **not in the EEA, Switzerland or the UK**. **[vendor (Chatwoot); official page confirms region limits]**
- Replies only within 48 hours of the person's message; text or a single image. Tokens last about 24 hours (refresh about 30 days). Webhook timestamps must be within 5 seconds of our clock. **[vendor]**
- The approval is for Relay's app, once, not per customer. Customers then connect with a "Continue with TikTok" button. So this is a company task for you, with an uncertain timeline.

### X (Twitter)
- Since February 2026 the API is pay-per-use. I found no official DM rate; two blogs say about $0.010 to $0.015 a request and disagree. **[unverified]**
- New DMs arrive through the Account Activity API (older) or the newer X Activity API. Developer forums describe webhooks that stop delivering, DM lookups that miss messages, and end-to-end encrypted chats whose content can't be read through the API. **[forum reports; unverified]**
- Needs user-context OAuth.
- Because we'd pay per request, either Relay carries the cost (needs a price on the plan) or each customer brings their own developer app and pays X directly.

### Viber
- Since February 2024 Viber bots exist only on commercial terms; business messaging goes through Rakuten Viber or one of its partners. Vendors cite a monthly minimum (about €100 to €150 per service) plus per-message fees. **[official statement in Viber's developer docs; vendor prices, inconsistent]**
- Webhook-based (the bot sets a webhook with its token). A 24-hour session opens when the person writes; up to 60 messages in it. **[vendor]**
- So: only for a customer who already has a Viber commercial account. We'd accept their token. We shouldn't sell Viber ourselves.

### WeChat
- Only a **Service Account** can use the customer-service message API. A message can be sent for 48 hours after the person's message, up to 5 times. **[official]**
- Whether a third-party system needs the account to be **verified** is disputed between sources; a verification fee is quoted at about $99 a year. **[unverified]**
- For international accounts, only images can be sent through the API; audio and video need a mainland-China account. **[vendor; unverified]**
- Messages arrive as XML to a webhook, with a signature check and optional encryption. Access tokens last 2 hours; the server's IP must be on an allow-list.
- Realistic customers: businesses selling into China with a registered account. A small audience.

### Apple Messages for Business
- A business can use it only through an **Apple-approved Messaging Service Provider**; it registers with Apple Business Register and picks one. **[official terms, as summarised by vendors]**
- Apple reviews the experience before launch, expects live agents in business hours, and conversations start with the customer (from Maps, Safari, Siri, a link). Proactive messages exist but only for Apple-approved uses with consent. **[vendor]**
- Becoming an MSP ourselves means Apple's approval and security work: not realistic now. The workable route is to accept an existing provider's API, so the customer holds the Apple account and the provider contract.

## What this means for the build

1. Two channels need nothing from anyone: **API** and, with a free bot token, **Telegram**. **LINE** needs a free official account. These can be built and tested fully by us.
2. **SMS and Voice** share one Twilio connection. The code is easy; the carrier rules (US registration) decide how fast a real customer can go live. Test numbers work without registration.
3. **Slack, Discord and Teams** are workspace-app installs. Slack is webhook-based. Discord forces an always-on process. Teams is narrow.
4. **TikTok, X, Viber, WeChat and Apple** are gated by an approval, a contract or a cost. Building them before the gate opens risks wasted work.

---

## Telegram: verified facts (1 November 2026)

*Read from Telegram's own pages: the Bot API reference, the Bots FAQ, the Bot features page and the webhook guide. "Not stated" means the official page says nothing, so we don't assume it.*

**Confirmed by Telegram's own documentation**
- Updates arrive by webhook (push) or `getUpdates` (pull), never both: a webhook disables `getUpdates` while it's set.
- `setWebhook`: the URL must be https (TLS 1.2 or higher, a certificate matching the domain that chains to a trusted root). Ports 443, 80, 88 and 8443 only. IPv4 only; IPv6 isn't supported for webhooks. `max_connections` 1 to 100. `drop_pending_updates` exists.
- `secret_token` (1 to 256 characters, A-Z a-z 0-9 `_` `-`) comes back in the `X-Telegram-Bot-Api-Secret-Token` header on every webhook call, so we can prove a call is Telegram's.
- A non-2xx answer counts as a failure and Telegram retries "a reasonable number of attempts". The exact count isn't stated, so every message must be safe to receive twice (it is: the message id is our dedupe key).
- With an empty `allowed_updates`, Telegram sends every update type except `chat_member`, `message_reaction` and `message_reaction_count`. We should ask only for what we use.
- Telegram's calls come from 149.154.160.0/20 and 91.108.4.0/22, which "may change", so we must not rely on an address allow-list.
- Message: `message_id` (unique inside one chat), `date` (Unix time), `chat` (with `id` and `type`), optional `from` (User: `id`, `first_name`, `last_name`, `username`, `language_code`), `text`, `caption`, `photo` (a list of sizes), `document`, `voice`, `audio`, `video`, `video_note`, `animation`, `sticker`, `location`, `contact`, `media_group_id`, `reply_to_message`, `business_connection_id`.
- Files: `file_id`, plus optional `file_name`, `mime_type`, `file_size` on documents, audio, video and animations; voice has `mime_type` and `duration`. A file's download link is valid for at least one hour. **Bots can download files up to 20 MB and upload up to 50 MB.**
- `sendMessage`: text is 1 to 4096 characters. Replying to a specific message uses `reply_parameters`.
- Error answers have `ok: false` and a `description`. The numeric `error_code` is "subject to change in the future", so we won't rely on it alone. A rate-limit answer carries `retry_after` seconds.
- Limits from the FAQ: about one message a second to one chat, 20 a minute in a group, and roughly 30 a second across all chats for broadcasts.
- A conversation starts when the person opens the bot's `https://t.me/<bot>` link and presses Start; `?start=<value>` passes a value to the bot (up to 64 characters of A-Z a-z 0-9 `_` `-`).
- Bots receive all private-chat messages whatever the privacy mode. In groups, privacy mode (on by default) limits a bot to commands and replies to it.
- **Telegram Business:** an owner turns on "Secretary Mode" for the bot in BotFather, then the account owner connects the bot to their Telegram account and chooses which chats it can reach. The bot gets `business_connection` (with `rights`, such as `can_reply`) and `business_message` updates, and replies by passing `business_connection_id`. Some actions are limited to private chats with an incoming message in the last 24 hours.

**Not stated by Telegram's pages, so not assumed (confirm with a real bot)**
- Whether a bot can ever message a person who hasn't started it, and the exact error when it tries.
- What exactly is returned when a person blocks the bot.
- The exact retry count and timing of a failed webhook delivery.
- The fields of the Sticker object and the `getMe` answer (the pages I could read didn't include them). We read them defensively: everything optional, nothing required.
- Whether `getFile` answers for a file just under 20 MB reliably on the hosted API.

**What this means for the design**
- Bot token and secret token live in Vault. The webhook address is `/api/webhooks/telegram/<key>`; the secret header is checked in constant time.
- Telegram addresses a person by their numeric `chat.id` (same as `from.id` in a private chat). There's no phone number or email, so people can't be matched to other channels automatically; a manager can merge them.
- Display name = first and last name; `@username` if there is one, otherwise nothing is invented.
- Plain text only when sending (no `parse_mode`), so a customer's or agent's special characters are never read as formatting.
