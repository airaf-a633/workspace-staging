# Milestone Plan

_v1, 2026-09-27. Replaces the week-based phases in `ENGINEERING_PLAN.md` §3. Scope comes from `PRODUCT_DECISIONS.md`: everything at launch, quality first, no fixed date._

## How we work
- **Who builds:** the founder full time; Claude Code writes most of the code; the founder reviews, tests, decides and handles every account and paperwork step.
- **One milestone at a time:**
  1. Each feature is built on its own branch and pull request.
  2. The milestone ends with a working demo and a test checklist.
  3. The founder approves before the next milestone starts.
- **Done means:**
  - tests pass in CI;
  - permissions are tested for every role involved;
  - English and Arabic both work (from M4 on);
  - the checklist is ticked by the founder.
- **Local development:** Docker Desktop + local Supabase. The hosted dev/staging projects are in Frankfurt.
- **Estimates:** full-time weeks with Claude Code. They are ranges, not promises; each milestone is re-estimated when it starts.

## Timeline at a glance

| # | Milestone | Estimate | Cumulative | Gate |
|---|---|---|---|---|
| M0 | Setup | 3–5 days | week 1 | Repo, CI, local database running |
| M1 | Foundations: tenancy, sign-in, roles | 1.5–2 weeks | week 3 | A restricted role can't see what it shouldn't |
| M2 | WhatsApp inbox core | 3–4 weeks | week 7 | Real messages both ways, handoffs work, nothing lost |
| M3 | CRM core | 2–3 weeks | week 10 | A pipeline runs from WhatsApp chats |
| M4 | Design system in the app + onboarding | 2–3 weeks | week 12–13 | Every screen so far works in English and Arabic |
| **Beta** | **Private beta for deposit holders** | — | **~week 13** | Meta Tech Provider approved, legal docs live, backups tested |
| M5 | Manager workspaces, routing, notifications | 2 weeks | week 15 | Two managers work from different homes; routing rules run |
| M6 | Email, calendar, sign-in providers | 2–3 weeks | week 18 | An email and a WhatsApp chat share one contact's timeline |
| M7 | Store and selling tools | 2–3 weeks | week 21 | A Shopify order, a payment link and a quote PDF work in chat |
| M8 | AI | 2 weeks | week 23 | Suggest, translate, summarise, tag and after-hours replies, metered |
| M9 | Templates, campaigns, automations | 2–3 weeks | week 26 | A campaign to an imported list goes through consent + approval |
| M10 | Billing, reports, API, security | 3 weeks | week 29 | Trial to paid on their own; full API behind permissions |
| M11 | Orders & Delivery pack | 3 weeks | week 32 | A real delivery day end to end, cash reconciled |
| M12 | Hardening and launch | 2 weeks | **week 34** | Load test, security review, Arabic review, launch |

**Honest total:** about **34 weeks (roughly 8 months)** at full time, with the private beta around **week 13**. Some milestones can overlap once the core is stable, which could save 3–5 weeks. Any new scope adds time.

## Paperwork and accounts (founder, runs in parallel)

The founder owns this track. The **Needed by** column is the milestone that stops if the item is late.

| Step | Starts | Takes (estimate) | Needed by |
|---|---|---|---|
| Accounts: GitHub, Supabase, Vercel, Fly.io, Anthropic, Sentry | M0 | 1 day | M0 |
| Meta developer account + test app (free test number) | M0 | 1 day | M2 (development) |
| Domain, business email, simple site with privacy policy | M0 | 1 week | M2 (Meta app details) |
| UAE free-zone trade license (compare 3 quotes) | Week 1 | 1–3 weeks | Meta verification |
| Meta Business portfolio verification | After license | 1–2 weeks | Tech Provider review |
| **Meta Tech Provider App Review** (2 screencasts from the M2 demo) | End of M2 | 2–4 weeks | **Private beta** |
| Terms, privacy policy, DPA + subprocessor list (lawyer) | Week 2 | 2–3 weeks | Private beta |
| UAE corporate bank account (apply to 2 banks) | After license | 2–6 weeks | M10 (Stripe) |
| Google Cloud project + OAuth verification (Calendar, Gmail send, sign-in) | M4 | 1–3 weeks | M6 |
| Microsoft Partner Center + publisher verification | M4 | 1–7 days | M6 |
| Inbound email provider (for Gmail capture address) | M5 | 1 day | M6 |
| Nango account | M5 | 1 day | M6 |
| Shopify Partner account + app + Level 2 customer data request | M5 | 1–4 weeks | M7 |
| Stripe (UAE), Tabby and Tamara merchant test accounts | After bank | 1–2 weeks | M7 (links), M10 (billing) |
| UAE e-invoicing research (Claude) + accounting apps: Zoho Books, QuickBooks, Xero developer accounts | M6 | 1 week | M10 (accounting sync) |
| Quiqup / Aramex API credentials | M9 | 1–3 weeks | M11 |
| Google CASA review for full Gmail sync (only if revenue justifies it) | After launch | 6–12 weeks | After launch |

**The single biggest risk to the beta date:** the license → Meta verification → Tech Provider review chain. It is 4–9 weeks end to end, so the license must start in week 1.

## Milestones in detail

Each milestone lists what gets built (**Scope**), what the founder does (**You**), and what must be true to approve it (**Done when**).

### M0 Setup (3–5 days)
- **Scope:**
  - initial commit;
  - GitHub repo and CI (typecheck, lint, tests on every pull request);
  - local Supabase via Docker, and hosted dev/staging projects in Frankfurt;
  - environment and secrets handling, Sentry, Vercel + Fly.io projects;
  - a README describing how to run everything.
- **You:** install Docker Desktop; create the accounts in the first rows of the paperwork table; start the trade license quotes.
- **Done when:** `pnpm test` and the local database run on your machine, and a pull request shows green CI.

### M1 Foundations (1.5–2 weeks)
- **Scope:**
  - schema and row-level security for workspaces, members, roles (templates plus custom), permissions with scopes (all / team / own), teams (which are also branches), invites and the audit log;
  - email + password and magic-link sign-in; invite flow; offboarding with reassignment;
  - a plain app shell;
  - pgTAP tests for every role.
- **You:** review the roles and permissions matrix before it's coded.
- **Done when:** two test workspaces can't see each other's data; an agent can't see another team's data or deal values; the audit log records every permission change.

### M2 WhatsApp inbox core (3–4 weeks)
- **Scope:**
  - Meta test app; webhook pipeline (verify, store, queue, worker); multiple numbers per workspace, each assigned to a team;
  - receiving and sending text, media and location; phone-app echoes, attributed to the chosen phone user;
  - coexistence onboarding with history import;
  - template sync and send; 24-hour window rules;
  - failed-send reasons in plain words;
  - conversations with holder, claim, live presence and claim lock;
  - handoff to a person or team with a required note, read-only followers, pinned note;
  - internal notes, @mentions, labels, canned replies;
  - returning-customer reopen (7 days); spam folder and blocking; realtime;
  - a plain inbox UI.
- **You:**
  - connect your own WhatsApp Business number as the first test;
  - record the two App Review screencasts from this demo;
  - submit Tech Provider review as soon as the license and Meta verification allow.
- **Done when:**
  - messages flow both ways, including ones typed on the phone;
  - a handoff chain works exactly as in the design demo;
  - restarting the worker mid-burst loses nothing;
  - fixture tests cover every webhook type.

### M3 CRM core (2–3 weeks)
- **Scope:**
  - contacts, with built-in fields (language, emirate/area, company, job title, birthday, gender, customer type), and companies;
  - typed custom fields that can be required; manager-owned tags; saved segments;
  - pipelines per team; deals with a separate owner; Won requires a value, Lost requires a reason;
  - lead source (ads, QR codes, campaigns, manual);
  - tasks; notes; one timeline per contact;
  - CSV/Excel import with duplicate preview; manual merge; imports from HubSpot, Zoho, Wati and WAManager exports;
  - erasure and retention settings.
- **You:** send 2–3 real customer lists (anonymised if needed) to test imports.
- **Done when:** a sales manager takes a WhatsApp lead through a pipeline to Won, and the deal value is hidden from Support.

### M4 Design system in the app + onboarding (2–3 weeks)
- **Scope:**
  - tokens as a Tailwind v4 theme; restyled shadcn components;
  - the design-system components (HandoffTrail, Composer and the rest);
  - English and Arabic right-to-left layout; per-person app language;
  - every screen from M1–M3 polished;
  - empty, loading and error states;
  - the 5-step onboarding checklist.
- **You:**
  - pick the brand colour with your team (Ink, Plum or Petrol) and a working product name;
  - find an Arabic reviewer;
  - start the Google and Microsoft verifications.
- **Done when:** every screen passes in English and Arabic at AA contrast, and a new workspace goes from sign-up to its first WhatsApp message through the checklist.

### Private beta (about week 13)
- **Gate:**
  - Tech Provider approved;
  - terms, privacy policy and DPA live;
  - production hosting with tested backups;
  - error monitoring;
  - a support channel for beta users.
- **You:** onboard 3–5 deposit holders, one at a time; hold weekly feedback calls. Beta feedback can reorder M5–M11.

### M5 Manager workspaces, routing, notifications (2 weeks)
- **Scope:**
  - **Manager homes:** role homes for Owner, Sales, Support and Operations, with sections that can be hidden and reordered.
  - **Hours and targets:** team working hours with UAE holidays and Ramadan ranges; reply targets and over-target flags.
  - **Routing:**
    - routing rules (keyword, ad, number, tag, language) with a default team queue;
    - a holder who's away returns the chat to the team queue after the wait limit;
    - owner override replies.
  - **Collaboration:** temporary collaborators; private staff chat per conversation; approval requests.
  - **Notifications:** browser notifications; installable web app with push; daily manager digest; opt-in urgent WhatsApp alerts to staff.
- **Done when:** the four homes match the design demo on real beta data, and routing and away rules are covered by tests.

### M6 Email, calendar, sign-in providers (2–3 weeks)
- **Scope:**
  - **Email:**
    - Nango; Outlook full sync of shared and personal mailboxes, with personal mailboxes private by default;
    - sending from Gmail, with the capture address and a guided forwarding setup;
    - company signature template;
    - email as separate conversations on the same contact.
  - **Calendar:** two-way Google and Outlook calendar sync per person; booking slots sent in chat with a reminder template.
  - **Sign-in:** Google and Microsoft sign-in.
- **Done when:** a customer's email and WhatsApp conversations sit on one contact after merging, and moving a calendar event moves its task.

### M7 Store and selling tools (2–3 weeks)
- **Scope:**
  - **Store sync:** Shopify (unlisted public app) and WooCommerce; orders linked to contacts by phone or email, with store-only customers otherwise.
  - **Order updates:** status templates when an order is confirmed, shipped or delivered.
  - **In chat:** product cards; Stripe, Tabby and Tamara payment links that update the deal or order when paid; quote PDFs from products; a location pin.
- **Done when:** a customer receives a product card, a quote and a payment link in one chat, and paying marks the deal Won.

### M8 AI (2 weeks)
- **Scope:**
  - on-request reply suggestions;
  - translation of Arabic, Hindi and Urdu messages in and out;
  - AI-drafted handoff notes;
  - auto-tagging that feeds routing;
  - knowledge from the catalogue, business info, uploaded documents and the workspace's own history (searched with pgvector, no training);
  - after-hours auto-reply (opt-in, Growth and up);
  - credit metering and top-ups;
  - business-scope guardrails to stay within Meta's AI policy.
- **Done when:** every AI action is metered, labelled and reversible, and an off-topic request is politely refused.

### M9 Templates, campaigns, automations (2–3 weeks)
- **Scope:**
  - **Templates:** builder with language versions picked automatically; ready-made library in English and Arabic; category check; AI writing help; rejection reasons explained.
  - **Campaigns:**
    - to segments or imported lists, with a consent note and owner approval for imports;
    - opt-out keywords and button;
    - 2 per week cap;
    - estimated Meta cost before sending;
    - replies routed to the current holder or the campaign's team.
  - **Automations:** rules for routing, auto-replies, CRM actions and store triggers.
  - **Ratings:** optional customer ratings after a chat is resolved.
- **Done when:** a campaign to an imported list is blocked until it has a consent note and owner approval, and an opt-out takes effect instantly.

### M10 Billing, reports, API, security (3 weeks)
- **Scope:**
  - **Billing:** Stripe plans (placeholder prices), seats with read-only viewers free, AI credit packs, add-on packs; 7-day grace then read-only; 90-day data hold.
  - **Reports:** team, sales, and campaigns with Meta cost; CSV and PDF export; scheduled email; owner WhatsApp summary.
  - **API:** full public API (labelled beta) and webhooks, using the same permission checks as the app.
  - **Security:** two-factor login; login alerts and sessions; export controls; owner-only bulk export; WhatsApp code sign-in.
  - **Accounting:** invoice drafts synced to Zoho Books, QuickBooks and Xero, following the e-invoicing research.
- **You:** set the final prices.
- **Done when:** a beta workspace moves from trial to paid on its own, and API calls can't exceed the caller's role.

### M11 Orders & Delivery pack (3 weeks)
- **Scope:**
  - **Orders:** one order list from chat, store orders and won deals.
  - **Dispatch:** dispatch board; rider daily-link page in English, Arabic and Urdu.
  - **Cash:** cash entries and handover.
  - **Couriers:** Quiqup and Aramex booking.
  - **Rider tracking:** live location with honest "last seen" times; proof of delivery with a photo or signature.
- **Done when:** a beta business runs a full delivery day in the pack, and cash reconciles to the fils.

### M12 Hardening and launch (2 weeks)
- **Scope:**
  - load test (1,000 messages a minute), security review, backup and restore drill;
  - data export and erasure checked against the PDPL;
  - full Arabic copy review;
  - help pages and a status page;
  - marketing site.
- **Done when:** all milestone checklists are re-run on production, and beta users confirm they'd pay.
