# M2 WhatsApp Inbox: Plan

_Drafted 2026-09-27. Starts only after M1 is approved. Estimate: 3–4 weeks full time. Built from PRODUCT_DECISIONS.md, ROLES_AND_PERMISSIONS.md and Meta's current docs (checked 2026-09-27)._

**Goal:** a business connects its WhatsApp number and keeps the phone app. Customer messages land in a shared inbox. The team claims, replies, hands over and follows conversations exactly as in the design demo, and no message is ever lost or duplicated.

## Facts from Meta that shape the design

| Fact (Meta docs) | Design consequence |
|---|---|
| Webhooks are retried for up to **7 days**, can arrive **more than once** and **out of order** | Store every raw event first. Deduplicate by WhatsApp message ID (`wamid`). Statuses only move forward (sent → delivered → read); a late "delivered" never overwrites "read". Order messages by Meta's timestamp, not arrival time. |
| Payloads can be up to **3 MB** | The webhook route only verifies, stores and queues; the worker does the work. |
| Signed with `X-Hub-Signature-256` (HMAC-SHA256 with the app secret) | Reject unsigned or mismatched requests before storing anything. |
| Coexistence needs the webhook fields `history`, `smb_app_state_sync` and `smb_message_echoes`, alongside `messages`, `account_update`, `message_template_status_update` and `phone_number_quality_update` | Subscribe to all of these from day one. |
| After Embedded Signup: exchange the code (`GET /oauth/access_token`), then subscribe our app to the customer's WhatsApp account (`POST /<WABA_ID>/subscribed_apps`). **A coexistence number is not registered again.** | An onboarding job runs these steps in order, with retries and a visible status. |
| Contact sync and history sync are requested with `POST /<PHONE_NUMBER_ID>/smb_app_data` (`sync_type`: `smb_app_state_sync`, then `history`). **History must be requested within 24 hours of onboarding**, or the business has to reconnect. It covers up to **180 days**. | A high-priority job with alerting. If it fails, the owner sees "Reconnect to import your history" long before the 24 hours run out. |
| Coexistence numbers send at a fixed **20 messages per second** | An outbound rate limiter per number. |
| The phone app disconnects after about **14 days** of inactivity, reported as `account_update` with `PARTNER_REMOVED` | Handled in M2 as a disconnected state (banner, sending blocked). The day-10 reminders come in M5. |
| Meta's free **test number** can message up to 5 verified recipients, without business verification | We develop on the test number until our own Tech Provider approval. |

## Your decisions for M2 (2026-09-27)
- **History:** import all 180 days quietly. Imported chats arrive resolved, with no notifications or reply targets.
- **Read receipts:** blue ticks are sent only when the **holder** opens the chat, not when a follower or viewer does.
- **Typing indicator:** shown to the customer while the **holder** types.
- **Message types:**
  - images, documents, voice notes and audio, video: received and sent;
  - location, contact cards, stickers and reactions: received and shown;
  - location and reactions: can also be sent.

## Build steps (each ends with something you can see)

| Step | Builds | You can see |
|---|---|---|
| 2.1 Pipeline ✅ | `webhook_events` table; `/api/webhooks/whatsapp` (verify token handshake, signature check, store, queue, return 200); worker loop with retries and dead-letter; replay tool. **Changed:** a small Postgres job table (`jobs`, claimed with SKIP LOCKED) instead of pgmq, so the same queue runs in all three test environments. | Test webhooks from Meta's dashboard land, and replaying one changes nothing |
| 2.2 Numbers | `whatsapp_accounts` (WABA, phone number ID, display number, team, status, quality, limit; access token in Vault); connect with the **test number**; account and quality webhooks | The Settings page shows the number connected, its status and quality |
| 2.3 Receive | Contacts created from WhatsApp IDs; conversations; messages of every type; media downloaded to private storage (signed links); ordering by Meta timestamp; realtime updates | A message sent from your phone to the test number appears live |
| 2.4 Send | Outbound queue; text, media, location, reactions; 20 per second limit per number; status updates moving only forward; failed-send reasons in plain words; 24-hour window rule; typing indicator; read receipts from the holder | Replying from the inbox reaches your phone with ticks updating |
| 2.5 Ownership | Holder, claim, live presence ("Omar is viewing / typing") and claim lock; handoff to a person or team with a required note; read-only followers; owner and manager override replies; collaborators; returning-customer reopen (7 days); resolve and reopen | The Mariam demo flow works end to end |
| 2.6 Team tools | Internal notes, @mentions (read access), staff chat per conversation, labels (managers create), canned replies, spam folder and blocking | Notes and mentions notify the right people |
| 2.7 Templates | Sync approved templates from Meta; template picker with variables and Meta cost; template status webhooks | Sending a template reopens a closed chat |
| 2.8 Coexistence | Embedded Signup with `whatsapp_business_app_onboarding`; onboarding job (token, subscribe, contact sync, history sync within 24 hours); phone-app echoes shown as "sent from phone" by the chosen phone user; the double-reply warning; history imported quietly; disconnect handling | Your real business number connects and its phone messages mirror in the inbox |

Step 2.8 needs **Meta Business verification** and, for customers' numbers, **Tech Provider approval**. Before approval we can still connect **our own** business's number through our own app, so 2.8 can be built and tested with it.

## Data model (new tables, all with workspace_id and row-level security)

| Table | Key columns |
|---|---|
| `webhook_events` | provider, raw payload (jsonb), signature valid, received_at, processed_at, attempts, last_error. Kept 30 days. |
| `whatsapp_accounts` | waba_id, phone_number_id (unique), display_phone, team_id, token (Vault ref), coexistence, phone_user_member_id, status (connecting / connected / disconnected), quality_rating, messaging_limit, history_sync_state, onboarded_at |
| `contacts` (starts here; completed in M3) | wa_id (E.164, unique per workspace), profile_name, name, locale, created_from (whatsapp / import / manual) |
| `conversations` | contact, whatsapp_account, team, holder_member_id, status (open / waiting / resolved / spam), last_customer_message_at, window_expires_at, last_message_at, resolved_at, imported |
| `conversation_followers` | member, added_reason (previous holder / mention / manual), until (for collaborators) |
| `handoffs` | from_member, to_member or to_team, note (NOT NULL, ≥10 characters), created_at |
| `messages` | wamid (unique per number), conversation, direction (in / out), source (customer / inbox / phone_app / system / ai), type, body, media_id → media, reply_to, reaction, status (queued / sent / delivered / read / failed), error_code, error_text, sent_by_member, meta_timestamp, imported |
| `media` | storage_path, mime, size, sha256, meta_media_id, downloaded_at |
| `internal_notes` | conversation, author, body, mentions (member ids) |
| `staff_messages` | conversation, author, body (the per-conversation staff chat) |
| `labels`, `conversation_labels` | name, colour token (text label always shown) |
| `canned_replies` | team (null means everyone), shortcut, body, language |
| `message_templates` | whatsapp_account, name, language, category, status, components, rejection_reason, last_synced_at |
| `blocked_numbers` | wa_id, blocked_by, reason |

**Permission checks** use the M1 keys (`conversations.view`, `.reply`, `.override`, `.claim`, `.handover`, `.collaborators`, `.notes`, `.spam`, `.resolve`, `templates.send`, `canned.use`, `numbers.manage`). Reply rights are checked in a database function, `can_reply(conversation)`: the holder, a live collaborator, or override scope.

## How each webhook event is handled

| Event | Handling |
|---|---|
| `messages` → message | Find or create the contact and conversation. Store the message (skip if the `wamid` already exists). Download media. Update the 24-hour window. Apply routing (default team queue in M2; rules in M5) and reopen rules. Notify. |
| `messages` → status | Update the status only if it moves forward. Store any failure error code with plain-language text. |
| `smb_message_echoes` | Store as outbound with `source = phone_app`, attributed to the workspace's phone user. If a member is typing in that conversation, show the double-reply warning. |
| `history` | Store as imported messages (resolved, no notifications); build conversations. The progress shows on the connection screen. |
| `smb_app_state_sync` | Create or update contacts from the phone's address book names. |
| `account_update` (`PARTNER_REMOVED`, etc.) | Mark the number disconnected; banner; block sending; alert the owner. |
| `phone_number_quality_update` | Store the quality and limit; alert the owner if it drops. |
| `message_template_status_update` | Update the template's status and rejection reason. |
| Unknown or unsupported | Store the raw event and mark it "ignored". Show "This message type isn't supported yet" in the thread instead of dropping it. |

## Edge cases covered in M2
- **Same customer on two of the business's numbers:** one contact, two conversations, one for each number.
- **Media over WhatsApp's size limits, or an unsupported file type:** blocked before sending, with the reason.
- **Media download fails or expires:** retried; after that the thread shows "Media couldn't be downloaded".
- **A reply to a message** shows the quoted original; a **reaction** attaches to its message, not as a new bubble.
- **Customer edits or deletes a message:** the thread shows "edited" or "deleted by customer". The original is kept for audit, visible to the owner only.
- **Two staff send at the same moment:** the claim lock allows only one; the other sees "Omar just claimed this chat."
- **The holder is removed from the workspace:** their conversations go to the team queue. This is the first piece of the offboarding reassignment step.
- **Worker down for hours:** events wait in the queue and Meta keeps retrying for 7 days. Nothing is lost, and processing catches up in order.
- **A message arrives on a number not linked to any workspace:** stored, logged as a security alert, never shown.
- **Blocked number writes:** stored in Spam, with no notifications.

## Tests
- **Fixture tests:** a recorded Meta payload for every event type and message type, including duplicates and out-of-order statuses. Replaying a fixture twice must give the same result.
- **pgTAP:**
  - `can_reply` for holder, follower, collaborator, override and viewer;
  - handoff note length;
  - isolation of every new table.
- **Load test:** 1,000 inbound messages in a minute through the pipeline; zero lost, zero duplicated.
- **Manual:** a checklist like M1's, using the test number and then your own number.

## What you need to do during M2
1. **Before 2.1:** create a Meta for Developers account and an app of type Business, add WhatsApp, and get the **test number**. Add your own phone as a test recipient. Give me the app ID and app secret through `.env`, never in chat.
2. **Before 2.2:** a public HTTPS address for webhooks while developing. I'll set up a tunnel (Cloudflare Tunnel or ngrok), and you create the free account.
3. **Before 2.8:**
   - a WhatsApp Business app phone on version 2.24.17 or later, for our own business number;
   - Meta Business verification started;
   - the App Review screencasts recorded from the 2.4 and 2.7 demos.

## Risks
- **Meta approvals:** Business verification and Tech Provider review decide when *customers'* numbers can connect, not when we can build.
- **Coexistence sync behaviour:** it's newer and less documented than the rest of the API. Budget extra days in 2.8 and test with a real phone early.
- **Browser voice-note recording:** codecs differ across browsers. WhatsApp needs OGG/Opus, so recordings may need converting in the worker.
