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

## Decisions I need from you

### Backend

1. **Which AI model and provider?** The privacy policy already names Anthropic. Options:
   - one provider for everything;
   - a cheap, fast model for tagging and translation, and a stronger one for Ask AI and agents.

   I recommend the second; the cost difference is large at volume.
2. **Data residency for AI.** Our database is in Frankfurt, but the model provider may process data in the US. Is a zero-retention agreement enough for your UAE customers, or do some need EU or UAE processing? This decides providers and price.
3. **How AI finds the right records:**
   - search over the workspace's chats and records at the moment someone asks; or
   - a pre-built index per workspace (faster, more storage, needs deleting when a customer is erased under PDPL).

   I recommend starting with on-the-moment search, adding the index later.
4. **Where agents run:** the Fly.io worker on a schedule (sales follow-up each morning, triage on every new chat). Is once a morning right for briefings and follow-ups, or should they run several times a day? This changes credit use.
5. **Who pays for agents' credits?** Agent runs cost credits too. Do they come from the plan's monthly credits (simple, but can surprise the owner) or a separate agent allowance?
6. **Automation limits:** how many active recipes per plan, and what happens when credits run out: pause AI only, or pause the automations as well?
7. **Audit:** I suggest logging every AI action (who asked, what it saw, what changed) in the audit log, kept as long as other audit entries. Is that OK given the storage cost?
8. **Customer opt-out:** if a customer says "I want a human", should after-hours AI stop for that customer for good?

### Frontend

1. **Voice:** should people be able to talk to Ask AI on the phone (voice in, text out)? It's useful in shops, but it means an extra transcription cost.
2. **Agent names:** keep functional names ("Sales follow-up"), or let the owner name them ("Noor, our assistant")? Names feel friendlier, but customers may mistake them for staff.
3. **Approve in bulk:** should "Approve all 5 follow-ups" exist, or one at a time only (safer, slower)?
4. **Home placement:** agents sit above "Needs you now" today. Should they go below it, so customers waiting always come first?
5. **Arabic AI replies:** AI writes to customers in the customer's language. Should staff always see a translation of what AI suggested (as in Lina's chat), or only on request?

## What's not built yet

- No real model, credit metering, scheduling or audit log. The preview's answers are scripted from the sample data (`lib/ai-sample.ts`, `components/ai/*`).
- AI-sent message bubbles (the receptionist's replies) and topic tags in the inbox list come with the backend work.
