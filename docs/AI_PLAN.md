# AI: assistant, agents and automations

Decided 2026-10-01. The preview shows all of it with scripted answers; no AI model is connected yet.

## What we decided

- **AI assists, people decide.** AI drafts, summarises, translates and prepares work. A person approves anything that changes data or reaches a customer. The only exception is the after-hours receptionist, once the owner switches it on (decided 2026-09-27).
- **Ask AI on every screen:** a side panel, opened from the menu or ⌘K / Ctrl+K. It knows which screen you're on. People can:
  - ask questions ("Which quotes went quiet?"), answered with links to the records;
  - ask for work ("Create follow-ups for those"): AI shows exactly what will change, with checkboxes, and nothing happens until they press the button. Undo afterwards;
  - describe automations in their own words. AI turns them into a plain-language recipe (When / Only if / Then) with a test run on last week, then Turn on. Recipes are listed and switched off in Settings › AI.
- **AI has exactly the user's permissions.** An agent's AI can't see deal values or other teams. Billing, WhatsApp numbers and team members are never available to AI, even for the owner.
- **In the chat:**
  - **Summarise this chat:** 2 credits, team only.
  - **Suggest reply:** 1 credit, written in the customer's language.
  - **Translate** a customer message into the reader's language: 1 credit.
  - **Transcribe** a voice note: 1 credit.
  - **Draft with AI** for handover notes: 1 credit.
- **Agents on Home ("From your agents").** Each works for a role:

  | Agent | What it does | Reports to |
  |---|---|---|
  | Sales follow-up | Drafts follow-ups for quiet quotes | Owner, sales manager, agents (their own deals) |
  | Support triage | Tags topics, flags urgent chats, suggests who takes them | Owner, support manager |
  | After-hours receptionist | Answers outside working hours from business knowledge | Off by default; Growth plan and up |
  | Daily briefing | Morning summary of what's due, late and changed | Everyone |
- **Clearly marked:** everything AI made carries the violet AI tag, and the credit cost shows before it runs. Customers see AI-sent replies labelled as AI.
- **Settings › AI:** agents on or off, automations, business knowledge (hours, prices from the store, FAQ, tone), credits, privacy.
- **Meta's rule (since 15 January 2026):** general-purpose AI chatbots are banned on the WhatsApp Business Platform. Business-specific assistants are allowed. So the receptionist answers only from the workspace's own business knowledge and hands anything else to a person.

## Decided in the second round (2026-10-01)

### Backend

- **Models:** two tiers from one provider. A fast, cheap model for tagging, translation and transcripts; a stronger one for Ask AI and agents.
- **Data region:** any region, with zero retention and no training on customer data. Stated in the privacy policy.
- **Agent credits:** paid from the plan's monthly credits. The owner sets a monthly cap per agent; at the cap the agent pauses and says so.
- **Schedule:** triage runs on every new chat. Sales follow-up and the daily briefing run once a morning at 08:00 Dubai time.
- **Finding information:** search the workspace's records and recent chats at the moment someone asks. A search index comes later if answers are slow. Erasing a customer (PDPL) stays simple.
- **Audit log:** every AI action is logged (who asked, what changed or was sent), without the full prompt text.
- **Automation limits:** active recipes are capped at Starter 3, Growth 10, Business 30. When credits run out, recipes with an AI step pause and the owner is told.
- **"I want a human":** when a customer asks for a person, after-hours AI stops for that customer for good. It's marked on their profile, and staff can switch it back on.

### Frontend

- **Bulk approval:** allowed, through a review screen that lists every draft before one Send button.
- **Home order:** agents sit below "Needs you now". Waiting customers come first.
- **Agent names:** the owner can name agents (e.g. "Noor"). A named agent is always marked as AI, to staff and to customers.
- **Voice:** voice input for Ask AI at launch (+1 credit per spoken question). The preview uses the browser's speech recognition; the real app uses the transcription model.

## Decided in the third round: knowledge, customer-facing AI and edge cases (2026-10-01)

### Business knowledge and the receptionist

- **Who keeps knowledge current:** the owner and managers edit it. AI proposes new FAQ entries from questions staff answered more than once, and the owner approves them before AI uses them.
- **When AI doesn't know:** it replies "Our team will reply when we open at {time}", marks the chat for the morning and offers the question as a new FAQ entry.
- **AI label for customers:** every AI-sent WhatsApp reply starts with a first line: "🤖 {Business} assistant (AI)". If the owner named the agent, the line becomes "🤖 Noor, {Business} assistant (AI)".
- **What the receptionist may send:**
  - text;
  - the location and opening hours;
  - catalogue photos with prices;
  - order status, only to the number that placed the order.

  Each can be switched off per workspace, down to text-only.
- **Prices:** AI quotes catalogue prices only. It never promises discounts or delivery dates. If a customer quotes a wrong AI price back, the exact message goes to the owner and staff decide case by case. The business isn't bound by it.

### Quality

- **Feedback:** a thumbs-down on any AI output, with an optional reason (wrong fact, wrong tone, wrong language). The owner gets a weekly list and can turn wrong facts into knowledge fixes.
- **Agent stats** in Settings › AI, per agent, this month: drafts approved as-is, edited and skipped, plus credits used.

### Edge cases

- **A person and AI at once:** if anyone on the team replied in the last 30 minutes (inbox or phone app), AI stays quiet in that chat.
- **Sensitive messages** (health complaints, legal threats, payment disputes, abuse): AI never answers. It tags the chat Sensitive and alerts the owner and the team's manager straight away, even after hours.
- **Other languages:** AI replies in the customer's language inside the 24-hour window, and staff see a translation. Templates fall back to English.
- **Someone leaves:** their pending AI drafts are cancelled. Automations they created move to the owner and keep running, with a note saying where they came from.

### Frontend still to build for these

- the thumbs-down with a reason on every AI output;
- agent stats in Settings › AI;
- per-workspace switches for what the receptionist may send;
- FAQ suggestions waiting for approval;
- the Sensitive tag and its alert in the inbox;
- the AI label preview in Settings.

## What's not built yet

- No real model, credit metering, scheduling or audit log. The preview's answers are scripted from the sample data (`lib/ai-sample.ts`, `components/ai/*`).
- AI-sent message bubbles (the receptionist's replies) and topic tags in the inbox list come with the backend work.
