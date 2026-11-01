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

---

## LINE: verified facts (1 November 2026)

*Read from developers.line.biz (Messaging API overview, receiving messages, sending messages, signature verification, channel access tokens, pricing, Build a bot, and the API reference). "Not stated" means the official page says nothing, so it is not assumed.*

**Confirmed by LINE's own documentation**
- **Setup:** create a LINE Official Account, enable the Messaging API in LINE Official Account Manager (this makes a Messaging API channel and needs a *provider*, which can't be changed later), then open the channel in the LINE Developers Console.
- **Webhook:** the owner enters our HTTPS address under Messaging API > Webhook URL, presses **Verify**, then turns on **Use webhook**. Self-signed certificates aren't allowed. Verify sends a request with an empty `events` array, which we must answer with 200. Redelivery of failed webhooks is a separate switch that is **off by default**; delivery is never guaranteed, and LINE may stop sending after long failures.
- **Defaults to turn off:** "Greeting message" and "Auto-reply messages" are **on** by default in LINE Official Account Manager; LINE recommends turning them off when a bot answers, or customers get two replies.
- **Signature:** every call has an `x-line-signature` header: HMAC-SHA256 of the **raw** body (UTF-8, unmodified) with the channel secret, base64. Reject on mismatch or a missing header. The header's capitalisation may change, so read it case-insensitively. LINE's addresses aren't published, so there is no IP allow-list.
- **Body:** `destination` (the bot's user id) and `events[]` (may be empty). A message event has `type`, `mode`, `timestamp` (Unix ms, the original time even when redelivered), `source` (`user`, `group` or `room`), `webhookEventId` (ULID), `deliveryContext.isRedelivery`, `replyToken` and `message`. `mode: standby` means no reply token and no sending.
- **Messages:** `text` (with `text`), `image`, `video`, `audio`, `file` (`fileName`, `fileSize`), `location` (`title`, `address`, `latitude`, `longitude`), `sticker` (`packageId`, `stickerId`; the sticker image itself **can't be retrieved**). Images, video, audio and files have `contentProvider.type`: `line` (download it) or `external` (links given).
- **Who the customer is:** the event carries only a `userId`. A name needs `GET https://api.line.me/v2/bot/profile/{userId}` (the endpoint is confirmed; its response fields weren't in the parts I could read).
- **Files:** `GET https://api-data.line.me/v2/bot/message/{id}/content` with the channel access token. 200 returns the file (the `Content-Type` header says what it is); **202** means a large video or audio isn't ready yet; 404 and 410 are errors. **Content is deleted after an unstated period**, so we must download promptly.
- **Friend and block events:** `follow` (added as a friend or unblocked; carries a reply token; `isUnblocked` isn't fully reliable) and `unfollow` (the account was blocked, one-to-one chats only). There is no endpoint to ask "is this person a friend".
- **Sending:** reply `POST https://api.line.me/v2/bot/message/reply`, push `POST https://api.line.me/v2/bot/message/push`. Up to 5 message objects per request; a text message is at most **5000 characters**. A reply token works **once** and should be used **within about a minute**; LINE says the limit may change and must not be relied on. A used or expired token gives a 400 "Invalid reply token". Push takes `to` (a `userId`) and an optional `X-Line-Retry-Key` (a UUID we make); a repeat returns 409. **Pushing to a person who blocked the account returns 200 but isn't delivered**, so a block can't be learned from a send.
- **Cost:** reply messages are **free**; push, multicast, broadcast and narrowcast count toward the plan's monthly messages, counted per recipient. Messages that can't be delivered (blocked, unknown id) aren't counted. Beyond the plan's allowance a send returns an error (429) and isn't sent. The plans and free amounts **differ by country**; the only table LINE shows on its pricing page is Japan: Communication plan free with up to 200 free messages a month, Light JPY 5,000 with 5,000, Standard JPY 15,000 with 30,000 and extra messages at up to JPY 3 each.
- **Tokens:** *long-lived* (no expiry, one per channel, issued in the console, revoked when reissued, reissuing can extend the old one by up to 24 hours), *short-lived* (30 days), *v2.1* (you choose up to 30 days; made with a signed JWT), *stateless* (15 minutes, can't be revoked). The Build a bot page recommends v2.1 with automatic renewal.

**Not stated or not read, so not assumed (confirm with a real account)**
- The exact response fields of Get profile, and Get bot info (`GET /v2/bot/info`, confirmed to exist and to return the bot's user id and display name, but I did not read the response itself).
- Whether the channel secret or access token can be validated some other way; we use Get bot info as the check and treat the answer defensively.
- Whether LINE can set the webhook address for us (a "Set webhook endpoint URL" API exists but I could not read its details), so the owner pastes the address in the console and presses Verify (the documented path).
- The content retention period; the exact redelivery window; the reply and push rate limits.
- How the "Allow bot to join group chats" setting behaves.

**What this means for the design**
- The customer pastes three things from the LINE Developers Console: **Channel secret** and **Channel access token (long-lived)**, then pastes **our webhook address** back into the console. Relay checks the token with Get bot info before saving anything.
- A support agent usually replies after more than a minute, so most replies are **push messages that use the customer's LINE plan allowance**. The screens must say so plainly, and a send refused because the allowance is used up must say that in words.
- Because pushing to someone who blocked the account looks like success, a block is only known from the `unfollow` event; we mark the customer as blocked from that event, and stop offering the composer until they follow again.

---

## SMS and Voice on Twilio: verified facts (1 November 2026)

*Read from twilio.com/docs: the messaging webhook guide, webhook security, the Message resource, Advanced Opt-Out, the Voice TwiML and call pages, `<Record>`, and the Recording resource. "Not stated" means the official page says nothing, so it is not assumed.*

**Confirmed by Twilio's own documentation**
- **Receiving a text:** Twilio makes a request in `application/x-www-form-urlencoded` form to the address set on the number. Parameters include `MessageSid`, `AccountSid`, `From`, `To`, `Body`, `NumMedia`, `NumSegments`, and for pictures `MediaUrl0`, `MediaContentType0` (and so on). Twilio expects TwiML back (an empty `<Response/>` is the normal "no reply"; the page doesn't spell that out, so we confirm with a real number).
- **Is it really Twilio:** the `X-Twilio-Signature` header is the **base64** of an **HMAC-SHA1**, keyed with the account **Auth Token**, of: the full URL exactly as Twilio sent it (through the end of the query string), followed by every POST parameter sorted alphabetically (case-sensitive) as name then value with no separators. "If you decode or re-encode the URL, signature validation fails." For SMS over https the port is kept in the URL. A trailing-slash rewrite by a server breaks it.
- **Sending a text:** `POST https://api.twilio.com/2010-04-01/Accounts/{AccountSid}/Messages.json` with `To`, a sender (`From` or `MessagingServiceSid`) and `Body` (up to **1,600 characters**; over 160 GSM-7 or 70 Unicode characters a text is split into billed segments). Authentication is HTTP Basic: Account SID with Auth Token (or an API key).
- **Delivery tracking:** a `StatusCallback` address can be given per message. Twilio posts `MessageStatus` (`queued`, `sending`, `sent`, `delivered`, `undelivered`, `failed`, and others) and, for `failed` or `undelivered`, an `ErrorCode`. Twilio warns that `error_code` values may change and shouldn't be relied on programmatically, and that callback parameters may change without notice, so our check accepts extra parameters.
- **Pictures:** up to 10 `MediaUrl`s per sent message; 5 MB for jpeg, jpg, png and gif, 500 KB for other types.
- **STOP:** on long codes Twilio handles `STOP, UNSUBSCRIBE, END, QUIT, STOPALL, REVOKE, OPTOUT, CANCEL` itself and sends the confirmation. It then blocks the number: later sends fail asynchronously with error **21610**. The webhook reports it as **`OptOutType`** (`START`, `STOP` or `HELP`), and Twilio advises against sending another message yourself. `START` and `UNSTOP` re-subscribe ("YES" does not). US toll-free numbers always unsubscribe on STOP.
- **Calls:** a call webhook always carries `CallSid`, `AccountSid`, `From`, `To` (E.164), `CallStatus` (`queued`, `initiated`, `ringing`, `in-progress`, `completed`, `busy`, `failed`, `no-answer`, `canceled`) and `Direction` (`inbound`, `outbound-api`, `outbound-dial`). **The answer must be TwiML** (`<Say>`, `<Record>`, `<Dial>`, `<Hangup>` inside `<Response>`), so whoever receives the call webhook decides what the caller hears.
- **Call status callbacks** carry `CallSid`, `CallStatus`, `CallDuration` (seconds), `Duration` (minutes, as billed), `Direction`, `From`, `To`, `Timestamp` and `SequenceNumber`. `completed` means answered and ended normally.
- **Voicemail with `<Record>`:** defaults `maxLength` 3600 s (120 s when transcribed), beep on, silence trimmed. The recording address is sent to `action` and to `recordingStatusCallback` (status `completed` or `failed`, with `RecordingSid`, `RecordingUrl`, `RecordingDuration`). The file may not be ready when `action` fires. Adding `.mp3` gives an MP3; otherwise WAV.
- **Recording files** need HTTP Basic authentication; the file can only be fetched once the recording is `completed`. Recording metadata is kept 40 days after deletion.
- **Transcription:** a paid option on `<Record>`, American English only, for recordings between 2 and 120 seconds.

**Not stated or not read, so not assumed (confirm with a real number)**
- What Twilio does if the webhook answers with an empty body, and the webhook timeout and retry behaviour.
- Whether pictures sent to us (`MediaUrl0`) need authentication to download, and what redirects they use. We download with the account credentials and accept redirects.
- How a Twilio *number's* "status callback URL" behaves for inbound calls (that page section wasn't readable), so Voice relies on answering the call webhook itself.
- Whether a Twilio number's message webhook can be set through the API without the console (not read), so the owner pastes the address into the number's settings.
- US carrier registration (A2P 10DLC) amounts: Twilio's own pages disagreed with each other (a campaign vetting fee of $15 versus $40), so this is not quoted. The screens will say "Twilio may need you to register before US texts are delivered" and point to Twilio's console.

**What this means for the design**
- The customer connects their **own Twilio account**: Account SID and Auth Token (the Auth Token is the signature key, so it is required either way), plus the phone number they text from.
- The webhook route rebuilds the exact URL from Relay's configured public address (never from the proxied request), parses the form, and checks the signature.
- Replies are plain text up to **1,600 characters** (the database limit for SMS is lowered from 4,096), with a `StatusCallback` so the thread shows delivered and failed.
- A STOP reply comes through as `OptOutType=STOP`.
- **Voice is different in kind:** because the call webhook must answer with TwiML, a Relay Voice channel has to decide what happens to a caller (ring a phone, take a voicemail). That's a product decision, asked when Voice starts.

## Voice on Twilio: verified facts (2026-11-02)

Sources: Twilio docs for TwiML overview, Record, Dial, Call resource, Recording resource, webhook security.

**Confirmed**
- An incoming call makes Twilio request the URL set on the number (GET or POST). Our server answers with TwiML (XML in a `<Response>`), run top to bottom.
- Always sent: CallSid, AccountSid, From, To (E.164), CallStatus, ApiVersion, Direction, ForwardedFrom, CallerName, ParentCallSid, CallToken. City/state/country fields come when available.
- Verbs: Say, Play, Record, Dial, Gather, Hangup.
- Signing: one process for all webhooks (X-Twilio-Signature, HMAC-SHA1 keyed with the auth token over URL + params). No voice-specific difference is stated, so the SMS signature check applies.
- Record: maxLength (default 3600 s), timeout = silence seconds (default 5), transcribe (paid, American English only, 2 to 120 s), recordingStatusCallback (POST, sent when the file is available), action (sent when recording ends; the file may not be fetchable yet).
- Recording callback fields: RecordingSid, RecordingUrl, RecordingDuration, RecordingStatus (completed or failed), RecordingChannels, RecordingSource, CallSid, AccountSid.
- RecordingUrl returns WAV by default; append .mp3 for MP3. Media is fetchable only when status is completed.
- Media URLs need HTTP Basic auth. Twilio recommends an API key SID and secret. It does not say the Account SID and Auth Token work.
- Recording metadata is kept 40 days after deletion. A retention period for the media file is not stated.
- Twilio warns that recording needs consent under laws such as California's Invasion of Privacy Act, and says to consult counsel. Recordings are not PCI compliant by default.
- Dial forwards a call to a number. Attributes: action (called after the dialed leg ends, with DialCallStatus, DialCallSid, DialCallDuration), timeout (default 30, min 5, max 600), callerId, record. DialCallStatus: completed, answered, busy, no-answer, failed, canceled.
- Outbound calls: POST /Accounts/{sid}/Calls.json with To, From (a Twilio number or verified caller ID), and Url or Twiml (max 4000 chars). StatusCallback events: initiated, ringing, answered, completed (default completed). Statuses: queued, ringing, in-progress, canceled, completed, busy, no-answer, failed. 1 call per second by default, up to 5 with an approved Business Profile. Inbound and Dial calls are not limited.
- A "completed" call can be answered by a person, a menu or voicemail, and is charged either way.

**Not stated in the pages read (so not assumed)**
- Whether the Account SID and Auth Token can download recordings (only API keys are named).
- The Calls resource page was read only up to character 100000 of 243258; the Recording page up to 100000 of 146503.
- Per-minute prices and country rules for voice numbers.
- Any way for a browser to take a live call (needs Twilio's Voice SDK; not researched yet).
- Whether transcription is available outside American English.

## Slack and Slack Connect: verified facts (2026-11-02)

Sources: docs.slack.dev pages for the Events API, request verification, URL verification, chat.postMessage, the message event, working with files, users.info, conversations.info and .list, installing with OAuth, rate limits, and "How apps work with Slack Connect".

**Confirmed**
- Events: Slack POSTs JSON to the request URL. The outer event_callback has type, token (deprecated), team_id, api_app_id, event, event_context, event_id (globally unique), event_time, authorizations, is_ext_shared_channel, context_team_id, context_enterprise_id.
- Answer with a 2xx within three seconds. Otherwise Slack retries up to three times (about immediately, 1 minute, 5 minutes) with x-slack-retry-num and x-slack-retry-reason headers. If over 95% of deliveries fail in 60 minutes, the subscription is temporarily disabled.
- Handshake: a url_verification POST with token, challenge, type. Answer 200 with the challenge (plain text, form, or JSON key "challenge"). Needs no scope.
- Signing: raw body; header X-Slack-Request-Timestamp (reject if more than five minutes off); basestring "v0:" + timestamp + ":" + raw body; HMAC SHA-256 with the app's signing secret as key; hex digest prefixed "v0="; compare with X-Slack-Signature using a constant-time compare.
- Messages: subscriptions message.channels (public only), message.groups (private), message.im, message.mpim; scopes channels:history, groups:history, im:history, mpim:history. Fields shown: channel, user, text, ts, channel_type, attachments, edited, subtype, hidden. Subtypes named include bot_message, message_changed, message_deleted, file_share, thread_broadcast; not every subtype is delivered.
- chat.postMessage: needs chat:write; channel is an ID; thread_ts is the parent's ts (not a reply's); response has ok, channel, ts, message; always check ok. Errors listed: not_in_channel, channel_not_found, is_archived, rate_limited / ratelimited (Retry-After), restricted_action (+ variants for read-only, locked and thread-only channels), msg_blocks_too_long, too_many_attachments. About 4,000 characters is recommended; over 40,000 is truncated. About one message per second per channel. Slack Connect sharing-blocked errors exist for canvases, file links and lists.
- Files: GET url_private or url_private_download with "Authorization: Bearer", scope files:read. Check https and an exact host match (such as files.slack.com) before sending the token, and do not follow redirects with credentials. Remote files point at any host: never send Slack credentials there.
- users.info: needs users:read; fields real_name, team_id, is_bot, profile.display_name; only the image fields are guaranteed in profile; email also needs users:read.email. is_stranger exists for users from foreign workspaces.
- conversations.info: needs channels:read and groups:read (also im:read, mpim:read); the channel object includes is_shared, is_org_shared, is_ext_shared, is_pending_ext_shared, is_private, is_archived, is_frozen, name.
- conversations.list: types public_channel (default) and private_channel; no filter for externally shared or for the bot's membership; limit up to 200 recommended, cursor paging; Tier 2 (20+ per minute).
- Rate limits are per method and per workspace; HTTP 429 with Retry-After.
- OAuth v2: authorize at slack.com/oauth/v2/authorize with client_id, scope, state, redirect_uri (https); a code valid ten minutes; exchange with oauth.v2.access (client_id, client_secret); the response has access_token, bot_user_id, app_id, team, enterprise, authed_user. Tokens do not expire unless token rotation is turned on.
- Slack Connect: a shared channel belongs to no single workspace; apps must use the Conversations API; use channel and user IDs, never names. Events from external users reach the app. External members are recognised by is_stranger and by a team_id different from the installing team; no single property confirms it. Everyone connected can read, write, share files and read history. Files may arrive with file_access "check_file_info", and the app must call files.info for full metadata. A bot can DM users on connected workspaces only if both are in a shared channel together. Channel IDs can change (a G-prefixed private channel becomes C-prefixed when a share starts: the channel_id_changed event). Slash commands and message actions work only for the installing workspace.

**Not stated in the pages read (so not assumed)**
- Whether the message event for an external user carries a team or user_team field (a Salesforce Trailhead module says "team"; the Slack pages I read do not). Relay would use users.info team_id instead.
- Whether an app installed in only one workspace receives every message of an external member in a shared channel, beyond "events from external users arrive in the app".
- Who on each side may add an app to a Slack Connect channel, and which plans allow Slack Connect.
- Whether a distributed app can be installed by other workspaces without a Marketplace listing.
- The exact error text for a message that is too long, and rate limits for conversations.history and conversations.replies.
- Which fields users.info withholds for external users beyond email and locale.
