# Engineering Plan

_v2, 2026-09-27. Replaces v1 (which had narrowed the product to delivery businesses)._

## 0. What we are building

A **WhatsApp-first business workspace** for UAE small businesses: the WAManager-style core (shared WhatsApp inbox, built-in CRM, email, calendar, store integrations, AI assist, automations, campaigns, analytics), plus the things that make it ours:

1. **Manager workspaces.** Each manager (owner, sales, support, operations) gets a role-specific home, views, permissions and numbers over ONE set of customer data. This is the headline difference: competitors give everyone the same inbox, and Chatwoot has only two roles.
2. **Business packs.** Optional modules that go beyond chat. The first is **Orders & Delivery** (orders, rider dispatch, cash reconciliation), already designed. Bookings could follow.
3. **Arabic and Urdu done properly**, with right-to-left layout throughout.
4. **Transparent pricing** with no markup on Meta fees, and **no number bans**: official Cloud API only.

Product name "Order Desk" is a working name from the delivery phase and should change.

## 1. Decisions locked

| Decision | Choice |
|---|---|
| Messaging | Our own WhatsApp inbox on the Cloud API (Embedded Signup + coexistence) |
| Email | Outlook/M365 full sync in the inbox at launch (free publisher verification). Gmail **send-only** at launch; Gmail full sync after the CASA review. Start the Google review once the app is stable (about week 10). |
| CRM | Built-in: contacts, companies, custom fields, tags, pipelines, deals, tasks, notes, timeline. HubSpot/Zoho sync after launch. |
| Market | UAE first. English + Arabic at launch; Urdu and Hindi soon after. |
| Orders & Delivery | Optional pack, built after the core MVP |
| Stack | Supabase (Frankfurt) + Next.js 16 on Vercel (fra1) + Node worker on Fly.io (fra) + Nango + Stripe + Claude API |
| Design | `design-system/` tokens, shadcn restyled, IBM Plex Sans/Arabic/Mono, Phosphor icons |

## 2. Repository layout

Unchanged from v1:

- `apps/web` (Next.js): the dashboard, the marketing site and the API routes.
- `apps/worker`: queue consumers and cron jobs.
- `packages/domain`: pure business rules.
  - money, phone numbers, business dates;
  - the order state machine, now used only by the Orders pack;
  - to add: permissions and pipeline logic.
- `packages/whatsapp`: the WhatsApp Cloud API client.
- `packages/email`: Graph and Gmail clients.
- `packages/ui`: shared components.
- `packages/i18n`: translations.
- `supabase/`: migrations, seed data and tests.

## 3. Phases (backend first, a working slice at each gate)

> **Superseded (2026-09-27):** build order and estimates now live in [MILESTONES.md](MILESTONES.md): 13 milestones, private beta around week 13, launch around week 34, built by the founder + Claude Code. Product rules live in [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md). The table below is kept for history.

| Weeks | Phase | Builds | Gate |
|---|---|---|---|
| 1–2 | 1. Foundations | Repo/CI, Supabase projects, schema v1 + RLS (workspaces, members, **roles + permissions**, contacts, companies, audit log), staff auth + invites, domain package | Two workspaces isolated; a user with a restricted role cannot read what the role hides |
| 2–6 | 2. WhatsApp inbox | Meta app + Embedded Signup (coexistence), webhook → queue → worker, inbound/outbound, templates, phone-app echoes, media, conversations with assignment, status, notes, mentions, canned replies, labels, realtime | A real number works both ways, messages sent from the phone included; no loss when the worker restarts mid-burst |
| 5–9 | 3. CRM | Contacts and companies with custom fields and tags, contact timeline (messages, emails, deals, notes, orders), pipelines + stages + deals, tasks with due dates and owners, import from CSV | A sales manager runs a pipeline from WhatsApp chats end to end |
| 7–10 | 4. Manager workspaces | Role templates (Owner, Sales, Support, Operations) + custom roles, per-role home dashboards and saved views, **team inboxes and routing rules**, per-role analytics (response time, pipeline value, workload) | An owner and a sales manager log in to different homes over the same data; permissions hold in the API as well as the UI |
| 9–12 | 5. Email, calendar, store | Nango; Outlook mail in the shared inbox (threads linked to contacts); Gmail send from contact and deal pages; Google/Outlook Calendar (meetings and task due dates, two-way); Shopify + WooCommerce (customer and order history on the contact, order events as triggers) | An email and a WhatsApp chat from the same customer appear on one timeline |
| 10–14 | 6. Design system + full UI | Tokens → Tailwind v4, restyled shadcn, i18n + RTL, all screens: inbox, contact/CRM, pipelines, manager homes, settings, onboarding | Every screen passes in Arabic and English; AA contrast |
| 12–16 | 7. AI, automations, campaigns, billing | AI reply suggestions, thread summaries and auto-tagging (business-scoped, human-approved, metered); automation rules (trigger, condition, action: assign, tag, auto-reply outside hours, create task, move deal); template campaigns to segments with opt-out and frequency caps; Stripe subscriptions in AED with plan limits | A pilot self-serves from trial to paid |
| 16–18 | 8. Hardening + pilots | Load test, backup drill, quality-rating alerts, data export/delete, onboard pilots | 10 paying workspaces, 7+ active daily |
| After MVP | Packs and extras | **Orders & Delivery pack** (design exists: orders, dispatch board, rider link page, cash handover); Gmail full sync after CASA; Instagram/Messenger; HubSpot/Zoho sync; Urdu/Hindi | Decided from pilot demand |

**The honest timeline:** the full platform is bigger than the delivery wedge. With two developers the MVP lands at **week 16–18**, not week 14. The biggest risks to that date:
- Meta App Review, which blocks connecting real customer numbers.
- Doing the manager-workspace permissions properly.

## 4. Data model v2 (core)

All tables carry `workspace_id` and have RLS on. Money is integer fils.

| Area | Tables |
|---|---|
| Tenancy and access | `workspaces`, `workspace_members` (user, role_id), `roles` (template or custom), `role_permissions` (resource, action, scope: all / team / own), `teams`, `team_members` |
| Channels | `channels` (type: whatsapp, email), `whatsapp_accounts`, `email_accounts` (provider, Nango connection, sync state) |
| Conversations | `conversations` (channel, contact, team, holder_id, status, priority, last_inbound_at, window_expires_at), `handoffs` (conversation, from, to, note NOT NULL with ≥10 chars, at), `conversation_followers` (member, read-only; previous holders are added automatically), `messages` (external_id unique, direction, source: customer / agent / phone_app / system / ai, type, body, media, template, status), `message_templates`, `canned_replies`, `labels`, `conversation_labels`, `mentions`, `webhook_events` |
| CRM | `contacts` (wa_id, email, name, locale, owner), `companies`, `contact_companies`, `custom_field_defs` (entity, key, type, options), custom values in jsonb validated against the defs, `tags`, `notes`, `tasks` (owner, due_at, status, linked entity), `pipelines`, `pipeline_stages`, `deals` (contact, company, stage, value_fils, owner, expected_close), `activities` (timeline, append-only) |
| Integrations | `integrations` (provider, Nango connection, status), `calendar_links` (task or deal ↔ external event), `store_customers`, `store_orders` (read-only mirror of Shopify/Woo, linked to contacts) |
| Automation and campaigns | `automation_rules` (trigger, conditions jsonb, actions jsonb, enabled), `automation_runs`, `segments` (saved filter), `campaigns` (template, segment, schedule, stats), `campaign_recipients`, `opt_outs` |
| AI and billing | `ai_usage`, `subscriptions`, `plan_limits`, `workspace_modules` (which packs are on) |
| Orders & Delivery pack | `orders`, `order_items`, `deliveries`, `riders`, `rider_links`, `cash_entries`, `handovers`, all behind `workspace_modules` |

**Handoff rules (decided 2026-09-27):**
- **What the customer sees:** one number, one chat, no staff names.
- **Replying:** only the current holder can reply.
- **Handing over:**
  - it requires a note of at least 10 characters, pinned for the new holder;
  - the previous holder becomes a read-only follower who can add internal notes.
- **Ownership:** conversation holder and deal owner are separate fields.
- **Phone replies:** echoes (`smb_message_echoes`) are stored with `source = 'phone_app'`. If one arrives while a member is typing in the same conversation, their composer blocks Send until they review it.

**Permissions model:** each action is checked twice, as defence in depth:
- in Postgres through RLS, with a `has_permission(workspace, resource, action)` helper;
- in the server action.

Scopes are:
- **all:** the whole workspace;
- **team:** conversations and deals of the member's teams;
- **own:** those assigned to or owned by the member.

**Role templates:**

| Template | Access |
|---|---|
| Owner | Everything, including billing |
| Sales manager | Pipelines, deals, contacts, campaigns, sales analytics |
| Support manager | Inboxes, routing, canned replies, support analytics |
| Operations manager | Orders pack, tasks, calendar, ops analytics |
| Agent | Own conversations and contacts |

## 5. Security, testing, environment

Same as v1:
- **Secrets and webhooks:** service role only on the server and in the worker; tokens in Vault; webhook signatures verified; audit log on every change; PDPL export and delete.
- **Tests:**
  - domain unit tests;
  - WhatsApp and email webhook fixture tests;
  - pgTAP tests for RLS **and role permissions**;
  - Playwright on the core loop: WhatsApp chat → contact → deal → task → email.
- **Docker Desktop is still needed for local Supabase.**
