# Build Plan — Path B: From-Scratch WhatsApp Team Inbox Platform

**Goal:** A WAManager-equivalent product (shared inbox + CRM + AI + automation + campaigns over WhatsApp/Instagram/FB/Email/Web-chat), built on our own code, on top of Meta's WhatsApp Cloud API, with no Chatwoot license constraints and full control over the billing/AI/data layers.

**Reference:** wamanager.io is a rebranded, self-hosted Chatwoot v4.10.0 + a custom PayPal billing/credits layer. That tells us the feature set that's table stakes — this plan builds an equivalent, not a copy of their code.

---

## 1. Product scope (v1 → v2)

**v1 (MVP, ships an actual sellable product):**
- WhatsApp Cloud API channel (send/receive text, media, templates, quick replies)
- Shared team inbox: conversation list, assignment, status (open/pending/resolved), internal notes, @mentions
- Basic CRM: contact profile, company, custom attributes, conversation history timeline
- Agents/roles: admin, agent, supervisor; per-inbox access control
- Canned responses + labels/tags
- Simple automation: rule engine (trigger → condition → action) for routing, tagging, out-of-hours auto-reply
- Basic analytics: response time, resolution rate, volume, agent workload
- Billing: seats + inbox limits + AI-credit metering, paid via Stripe (not PayPal — better for SaaS, subscriptions, usage billing, metered billing add-ons)

**v2 (parity/expansion):**
- Additional channels: Instagram DM, Facebook Messenger, Email, Website live-chat widget
- AI: smart-reply suggestions (RAG over a knowledge base), thread summarization, auto-triage/intent tagging
- Campaigns: template broadcast, audience segmentation from CRM tags, delivery/read/reply tracking, rate limiting
- Integrations: REST API, webhooks, Shopify/WooCommerce order lookup, Slack notifications
- SLA policies, business-hours calendars, reporting exports

Don't build v2 features until v1 has paying users validating the core loop — inbox + CRM + WhatsApp reliability is the whole value prop; AI and campaigns are retention/upsell features.

---

## 2. Why WhatsApp Cloud API (not BSP wrappers, not unofficial libraries)

- Meta's official **WhatsApp Business Platform (Cloud API)** is the only legitimate, ToS-compliant way to build a multi-agent WhatsApp product. Unofficial libraries (whatsapp-web.js style browser automation) violate Meta's ToS and get numbers banned — not viable for a commercial product.
- You'll need a **Meta Business Manager** account, a **WhatsApp Business Account (WABA)**, and to go through **Meta App Review** for the permissions you need (`whatsapp_business_messaging`, `whatsapp_business_management`).
- Two integration paths:
  - **Direct Cloud API** (self-managed): you own the webhook, phone number registration, message sending — lowest cost, most control, most integration work.
  - **Tech Provider / Solution Partner** via an existing BSP (e.g., a 360dialog, Gupshup, or Meta-direct "Tech Provider" embedded signup) — lets *your customers* connect their own WABA to your app via OAuth-like embedded signup, which is what you need for a multi-tenant SaaS. **This is the one to build for.**
- Apply for **Meta Tech Provider / Solution Partner status early** (weeks-long approval) — this gates your ability to onboard other businesses' WhatsApp numbers programmatically (embedded signup flow). Start this in parallel with engineering, not after.

---

## 3. High-level architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Marketing site (Next.js) — public, pricing, docs, signup        │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│  App Frontend (React/Vue SPA) — inbox, CRM, automations, admin   │
│  Real-time via WebSocket (Action Cable-style or Socket.io)        │
└─────────────────────────────────────────────────────────────────┘
                              │ REST/GraphQL + WS
┌─────────────────────────────────────────────────────────────────┐
│  API / App Server (multi-tenant)                                  │
│  - Auth (JWT + refresh, SSO/SAML for enterprise tier)             │
│  - Conversations, Contacts, Inboxes, Teams, Automations domain    │
│  - Billing service (Stripe: subscriptions + usage-based AI credits)│
│  - Channel adapters: WhatsApp Cloud API, IG, FB, Email, Web-chat  │
│  - Automation rule engine (event-driven)                          │
│  - AI service client (LLM calls: reply suggestions, summaries)    │
└─────────────────────────────────────────────────────────────────┘
        │                    │                     │
┌───────────────┐   ┌────────────────┐   ┌──────────────────────┐
│ Postgres        │   │ Redis            │   │ Background workers    │
│ (tenant-scoped) │   │ (queues, cache,  │   │ (Sidekiq/BullMQ):     │
│ + pgvector for  │   │  pub/sub for WS) │   │ webhook ingestion,     │
│  AI/RAG search  │   │                  │   │ campaign sends,        │
└───────────────┘   └────────────────┘   │ SLA timers, reports    │
                                          └──────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│  External: Meta Cloud API webhooks, Stripe webhooks, S3/R2 for   │
│  media storage, LLM provider (Claude API) for AI features         │
└─────────────────────────────────────────────────────────────────┘
```

**Multi-tenancy:** one Postgres schema-per-row (tenant_id/account_id on every table) is simpler to operate at this scale than schema-per-tenant. Enforce isolation at the ORM/query layer + row-level security as a second line of defense.

---

## 4. Stack recommendation

Given this session's own senior-fullstack-dev skill context (React 18 + Vite + TS + Supabase + TanStack Query + Tailwind + Radix/shadcn), that's a legitimate, faster-to-ship alternative to a Rails-style stack, and avoids reinventing infra:

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite + TypeScript, TanStack Query, Zustand/Context for local state | Fast iteration, matches modern SPA conventions |
| UI | Tailwind + Radix/shadcn | Ship inbox UI fast without a full design system build |
| Backend | Node.js (NestJS or Fastify) **or** Supabase (Postgres + Edge Functions + Auth + Realtime) | Supabase gets you auth, Postgres, realtime, storage "for free" — very good fit for an MVP team-inbox product; NestJS gives more control if you outgrow Supabase's Edge Function limits (long-running automation engine, heavy webhook fan-out) |
| Realtime | Supabase Realtime (Postgres logical replication) or Socket.io | Live conversation updates, typing indicators, presence |
| Queue/Workers | Supabase Edge Functions + pg_cron for light jobs; graduate to a dedicated worker (BullMQ on Redis, or a small Node worker service) once campaign sends / SLA timers need real scheduling | Webhook bursts from Meta need reliable async processing, not inline handling |
| DB | Postgres (+ pgvector extension) | Relational CRM/conversation data + vector search for AI RAG features |
| Auth | Supabase Auth (email + OAuth) or custom JWT | MFA support matters for an "enterprise" tier — check this early |
| Billing | **Stripe** (Billing + Metered Usage) | Recurring subscriptions (seats/inbox tiers) + metered AI-credit consumption in one product; far better DX than PayPal for a credits model |
| AI | Claude API (Sonnet for reply drafts/summaries, cheaper Haiku for lightweight classification/tagging) | Reply-copilot, summarization, RAG over a knowledge base for cited "smart replies" |
| Media storage | Cloudflare R2 or S3 | Inbound/outbound media attachments from WhatsApp |
| Hosting | Fly.io / Render / Vercel (frontend) + managed Postgres (Supabase/Neon) | Matches this environment's existing Fly.io familiarity |

---

## 5. WhatsApp Cloud API integration details (the hard part)

1. **Embedded Signup** (Meta's OAuth-like flow) lets a customer connect their own WhatsApp Business number to your app without you holding their credentials — required for a real multi-tenant SaaS. Implement Meta's JS SDK embedded signup flow in the inbox-creation wizard.
2. **Webhook endpoint**: single endpoint per app (not per tenant) receiving all inbound messages/status updates; you route by `phone_number_id` in the payload to the correct tenant/inbox. Must respond 200 within a few seconds — do real work in a background job, not inline.
3. **Message types to support**: text, image/video/document/audio, location, contacts, interactive (buttons/lists), reactions, and **template messages** (required to re-open a conversation after the 24-hour customer service window closes).
4. **24-hour session window**: free-form replies only work within 24h of the customer's last message; outside that, you must send a pre-approved **message template**. Your automation engine and campaign sender both need template-management UI (submit templates to Meta for approval, track approval status, variable mapping).
5. **Rate limits & quality rating**: Meta assigns a messaging tier (250/1K/10K/100K business-initiated conversations/day) that scales with your number's quality rating — build monitoring/alerting for quality-rating drops early, this is an operational risk your customers will blame you for.
6. **Coexistence** (mobile app + Cloud API dual use, the same "keep your app" feature WAManager markets) is a newer, narrower Meta capability with eligibility constraints — treat as a v2 differentiator once core flows are solid, not an MVP requirement.

---

## 6. Data model (core entities)

```
accounts (tenants)
  └─ users (agents/admins) ── account_users (role, per-inbox access)
  └─ inboxes (whatsapp | instagram | facebook | email | website)
       └─ inbox_channel_configs (WABA phone_number_id, tokens, webhook secrets)
  └─ contacts (phone/email identity, custom_attributes jsonb)
       └─ contact_conversations
  └─ conversations (inbox_id, contact_id, status, assignee_id, team_id, priority)
       └─ messages (content, message_type, sender_type, attachments, template_ref)
  └─ teams, labels, canned_responses
  └─ automation_rules (trigger jsonb, conditions jsonb, actions jsonb)
  └─ campaigns (template_id, audience_query, schedule, delivery_stats)
  └─ subscriptions (stripe_customer_id, plan, seat_count, ai_credit_balance)
  └─ ai_usage_events (for credit metering/billing reconciliation)
```

---

## 7. Billing/credits design (your real differentiation vs. a Chatwoot clone)

- Stripe Billing: one subscription per account, price = plan tier (seats + inbox count baked into plan, like WAManager's Starter/Pro/Business/Enterprise).
- **AI credits** as a separate metered add-on: track every AI call (reply suggestion, summary, auto-tag) in `ai_usage_events`, debit a credit balance, top up via Stripe metered billing or a manual "buy more credits" purchase.
- **WhatsApp conversation fees from Meta are pass-through, not yours** — be explicit in your pricing page (WAManager does this) that Meta's per-conversation charges are billed separately/directly, so you're not eating that cost or misrepresenting it.

---

## 8. Build sequence (rough phases, not calendar-committed)

1. **Foundations**: multi-tenant auth, account/user model, empty inbox shell, Postgres schema, CI/CD.
2. **WhatsApp channel**: Cloud API webhook ingestion, embedded signup, send/receive text+media, template send.
3. **Shared inbox core**: conversation list, assignment, internal notes, status, realtime updates.
4. **CRM**: contact profile, custom attributes, timeline, tags.
5. **Billing**: Stripe subscription plans, seat/inbox enforcement, upgrade/downgrade flows.
6. **Automation engine v1**: rule triggers (new message, business hours) → actions (assign, tag, auto-reply).
7. **Analytics v1**: response time, resolution rate, volume dashboard.
8. **AI v1**: reply-suggestion copilot (Claude API) with human approve-before-send, thread summarization.
9. **Additional channels**: Instagram, Facebook, Email, Website widget.
10. **Campaigns**: template broadcast + segmentation + delivery tracking.
11. **Hardening**: SLA policies, audit logs, RBAC granularity, SSO/SAML for enterprise tier, quality-rating monitoring, load testing webhook ingestion.

---

## 9. Key risks to plan for from day one

- **Meta App Review + Tech Provider approval timelines** — start this immediately, it can take weeks and gates multi-tenant onboarding.
- **Webhook reliability under burst load** — a single popular customer's campaign reply spike must not drop messages; queue + idempotent processing from the start.
- **Template approval turnaround** — Meta can take hours to days to approve message templates; build this into the campaign UX (don't let users think it's instant).
- **Quality rating / number bans** — a customer's poor messaging practices (spam-like campaigns) can tank their number's tier; you need per-tenant monitoring and guardrails (rate limiting sends, opt-out handling) or their outage becomes your support burden.
- **AI cost control** — cap and meter every LLM call from day one; runaway "smart reply" usage on a flat-fee plan will bleed margin.

---

## 10. What to explicitly *not* build in v1

- Don't build your own SAML/SSO — buy it (WorkOS or similar) until enterprise deals require it in-house.
- Don't build a custom realtime protocol — use Postgres logical replication (Supabase Realtime) or a boring Socket.io layer.
- Don't build campaign/segmentation before the inbox + CRM loop has real users — it's the least differentiated, most complex-to-get-right feature (rate limits, template variable mapping, opt-out compliance).
