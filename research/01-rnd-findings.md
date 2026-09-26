# R&D Findings: WhatsApp-first Business Workspace (UAE / Mediterranean / Asia)

_Compiled 2026-09-26 from four research tracks: competitors, WhatsApp/Meta platform, integrations, and Chatwoot due diligence. Items marked [3P] come from third-party sources only. Items marked [VERIFY] need confirming before we rely on them._

---

## 1. The honest verdict

1. **"A unified workspace connecting Gmail + Shopify + CRM + Calendar + WhatsApp" is not a product. It's a list of features, and a crowded one.**
   - Zoho Bigin already does CRM + WhatsApp + email for $7–18 per user, and it's a trusted brand.
   - WAManager sells a Chatwoot inbox + CRM for $9–99 per workspace. More than 15 other WhatsApp inbox tools exist (Wati, Interakt, AiSensy, Zoko, SleekFlow, respond.io, Kommo…).
   - Kommo already has per-pipeline role permissions.
   - None of these integrations can be our moat.
2. **The one unusual element in the brief is the second manager, the one handling dispatch and delivery.** That's where the real gap is:
   - **Order-to-cash for businesses that do their own deliveries and take orders mostly over WhatsApp:** restaurants, grocers, pharmacies, water/gas, laundry, florists, B2B distributors with 1–10 riders.
   - The workflow is: WhatsApp order → confirm → assign a rider → rider updates status → cash on delivery (COD) collected → end-of-day cash reconciliation per rider.
   - Inbox tools stop at the chat. Courier apps assume a third-party courier. Today these businesses use WhatsApp groups plus Excel.
   - This gap is **real but narrow and not yet proven**. No reviews asked for it, so we must validate it with interviews.
3. **E-commerce parcel dispatch is NOT a gap.** Courierify (Pakistan, $0–20/mo, 35+ couriers, COD reconciliation), Take App + Lalamove (SEA) and Salla/Zid apps (KSA) already cover it. COD-confirmation apps are commodities on every app store.
4. **"AI replies" is not a differentiator.** Meta Business Agent launched globally on 2026-06-03 and does catalog Q&A, bookings and a Shopify connection, and it's free or cheap. Meta also bans general-purpose AI chatbots (since 2026-01-15). AI has to be scoped to the business and serve the workflow.
5. **Twelve countries is far too broad.** Couriers, payment gateways, languages, data laws and Meta rates differ in every country. Pick **one beachhead country** plus **one vertical**.

---

## 2. Hard constraints (non-negotiable facts that shape the product)

| # | Constraint | Consequence |
|---|---|---|
| 1 | **Coexistence** (the phone app and the API on one number) is the only way target users keep their phone app. | Onboarding disables **broadcast lists**. **Group chats aren't synced.** Disappearing messages, view-once, live location, catalog "business tools" and calls all stop working. The owner must open the phone app every ~14 days or the number disconnects. SMBs who sell through groups or broadcast lists will **lose features by joining us**. We must test whether they'll accept that. |
| 2 | **From Oct 1 2026, service replies are billable** per message at the utility rate (reportedly the first 1,000 per number per month are free [3P, VERIFY]). | AI and inbox replies cost money: UAE ≈ $0.0157, PK ≈ $0.015, ID ≈ $0.025, EG ≈ $0.0036, IN ≈ $0.0014 [3P, VERIFY on Meta's CSV]. Replies the owner sends from the phone app are free [3P]. The product must be cost-aware: fewer, richer messages; click-to-WhatsApp ad entry points (72h free). |
| 3 | **Tech Provider model: each business pays Meta directly by card.** | Cards often fail in PK, EG, BD and LB. For those markets we need a **Multi-Partner Solution with a BSP** (e.g., 360dialog), which pays Meta on the customer's behalf. |
| 4 | **Messaging limits apply per business portfolio** (since Oct 2025). | Each customer must have its own Meta portfolio, never ours. |
| 5 | **The Groups API doesn't work on coexistence numbers** (and is capped at 8 participants). | We can't support WhatsApp groups. The rider workflow must use a rider web app (PWA) or 1:1 chats, not groups. |
| 6 | **No WhatsApp calling in the UAE.** Calling is also off under coexistence. | Calling is out of scope. |
| 7 | **Unofficial WhatsApp Web libraries** (Baileys, whatsapp-web.js, Evolution API). | **Never.** They put the customer's number at risk of a ban. Market "we'll never get your number banned" as a feature. |
| 8 | **Gmail read/sync uses a restricted scope** and needs a CASA security assessment (~$540–4,500/yr + 6–12 weeks + fixes). Chatwoot's Gmail inbox uses `https://mail.google.com/`, which is restricted. | MVP gets **Gmail send-only + Google Calendar** (sensitive scopes, ~1–3 weeks, $0) and **Outlook/M365 full sync** (free publisher verification). Full Gmail sync comes later, once revenue justifies CASA. |
| 9 | **Shopify** requires Level 2 Protected Customer Data review to show names and phone numbers. An App Store listing forces Shopify Billing. | Start as an **unlisted public app** [VERIFY billing rules]. WooCommerce, Salla, Zid and YouCan are easy. |
| 10 | **Stripe is unavailable** in PK, EG, TR, SA, PH and BD. | Bill through **Paddle** (merchant of record, ~5% + $0.50) or through a UAE entity using Stripe. Local gateways come later, and each needs a local entity. |
| 11 | **Chatwoot `enterprise/` is proprietary.** Captain AI, custom roles, SLA, audit logs, SAML, calling and campaign analytics are all in it. | Run **pure MIT** (`DISABLE_ENTERPRISE=true` or delete the folder). Build our own AI, roles and analytics. WAManager appears to run enterprise code under a "community" plan. Don't copy that. |
| 12 | **Data laws.** Turkey KVKK requires standard contracts **notified within 5 days**. Egypt's PDPL licensing grace period ends **2026-10-31**. Saudi PDPL requires SDAIA SCCs. India DPDP takes full effect 2027-05-13. The EU GDPR applies to GR/CY. | Click-through DPA, subprocessor list, SCC annexes. Local legal advice before entering EG or TR. |
| 13 | **Hosting.** AWS UAE and Bahrain lost availability zones to drone strikes in Mar 2026 [3P, reported by DCD]. | Host primarily in **Frankfurt** (eu-central-1). Add Mumbai when there's demand. Gulf region only as a dedicated add-on with DR. |

---

## 3. Chatwoot: how to use it

- **Pure MIT core, unmodified, plus side services.** Pin an upstream tag and upgrade every minor release within ~2 weeks. Upstream ships ~15 releases every 6 months. WAManager is 8 versions behind at v4.10, a sign of fork-upgrade pain.
- **Chatwoot does well:** WhatsApp Cloud API, Embedded Signup, coexistence echoes (messages sent from the phone are mirrored), templates, one-off campaigns, media/voice notes, interactive messages, IMAP/SMTP email, realtime, widget, 60+ locales including `ar`/`ur` with RTL (QA needed), Platform API for tenants and limits, webhooks, Agent Bots, Dashboard Apps (iframe inside a conversation).
- **Chatwoot is weak on:** CRM (contacts and companies only, no pipelines), reporting, roles (MIT has only admin and agent), search at scale, and memory use. It doesn't import coexistence history or contacts [likely, per code search]. Group chats aren't supported.
- **So:** the role-based manager views, orders/dispatch, CRM and billing **must live in our own app anyway**. Chatwoot is just the messaging engine.
- **The downside:** two UIs (Chatwoot's inbox and our workspace) joined by SSO and Dashboard Apps. That's a real UX seam. Long term we may replace Chatwoot's front end with our own on top of its APIs.

---

## 4. Integration verdicts

| Integration | Difficulty (1–5) | Approval required | Verdict |
|---|---|---|---|
| WhatsApp Cloud API (Tech Provider) + Embedded Signup + coexistence | 3 | Meta business verification + App Review | **MVP** |
| BSP Multi-Partner Solution (360dialog) for card-less markets | 3 | BSP contract | MVP if beachhead is PK/EG |
| Google Calendar | 2 | Sensitive-scope verification, 1–3 wks | **MVP** |
| Gmail send-only | 2 | Sensitive-scope verification | **MVP** |
| Gmail full inbox | 4 | CASA, 6–12 wks, ~$0.5–4.5k/yr | Later (or Unipile as a stopgap, with its brand on the consent screen) |
| Outlook / M365 | 2 | Publisher verification (free) | **MVP** |
| WooCommerce | 1 | None | **MVP** |
| Shopify (unlisted, Level 2 customer data) | 3 | Data-protection review | **MVP** |
| Salla / Zid | 2 | Partner approval | MVP if KSA |
| Daraz / Shopee / Lazada / TikTok Shop | 3–4 | ISV approval + marketplace rules against off-platform contact | Later/avoid |
| Couriers: Quiqup, Aramex (UAE); PostEx, Leopards (PK); Bosta (EG); Shiprocket (IN); EasyParcel (MY); Lalamove (SEA) | 2–3 each | Merchant's own courier contract | 1–2 per beachhead |
| Payment links (merchant brings own gateway): Paymob, Tabby, Tamara, Razorpay, Xendit, Stripe | 2 each | Merchant's own KYC | **MVP** (per region) |
| Nango (OAuth/sync infrastructure) | 2 | None | **MVP**. Doesn't solve CASA. |
| Merge / Paragon | — | — | Avoid (too expensive at SMB price points) |
| External CRM connectors (HubSpot/Zoho) | 3 | — | Later. Ship our built-in CRM first. |

---

## 5. Competitor pricing context (USD/month, platform fee only, before Meta fees)

WAManager $9–99 per workspace · Chatwoot Cloud $19–99 per agent · Wati $29–399 · Zoko $50–500 (unlimited agents) · respond.io $79–279 · SleekFlow ~$153+ · Kommo $25–45 per user · Zoho Bigin $7–18 per user · Courierify $0–20 · Take App free to ~$38 · Wetarseel (PK) ~$50.

**The loudest complaints across competitors:** terrible support, billing and cancellation traps, hidden markups on Meta fees, number bans, complexity. Arabic quality and missing ops features were **not** common complaints. Treat both as hypotheses.

---

## 6. Recommended direction (for discussion)

**Position:** "The WhatsApp order desk for local delivery businesses." Chat → order → rider → cash, with a separate view for each manager.

- **Sales/owner view:** inbox, customers, repeat-order rate, revenue, unpaid COD, campaigns.
- **Ops/dispatch view:** order board, rider assignment, live status, failed deliveries, cash per rider, end-of-day reconciliation.
- **Rider:** a mobile web page opened from a link (no app install, no WhatsApp group). Buttons for picked up / delivered / cash collected / proof photo. The customer gets automatic WhatsApp utility updates.
- **AI (scoped to the business):** turns a chat message into a draft order (items, address, notes), suggests replies in Arabic/Urdu/English, summarizes the day. Always human-approved.
- **Integrations in MVP:** WhatsApp (coexistence), Shopify/WooCommerce order import, Google Calendar (bookings/pickups), Gmail send + Outlook, 1–2 couriers for overflow, merchant payment links.
- **Pricing principles:** flat per workspace, **zero markup on Meta fees**, riders free, self-serve cancellation, local currency where possible.

**Architecture:** Chatwoot MIT (messaging engine) ⇄ webhooks/APIs ⇄ **our platform** (Next.js + Postgres), which handles tenants/billing, orders, dispatch, CRM, role views, the rider web app, AI service (connected as a Chatwoot Agent Bot), and integrations via Nango. Hosted in Frankfurt.

---

## 7. What we need before building

1. **15–20 customer interviews** in the beachhead city. Confirm that rider assignment and COD reconciliation are problems they'd pay to solve, and that they'll accept losing broadcast lists and group sync under coexistence.
   - **Stop signal:** fewer than ~40% say they'd pay at least $30/mo.
2. **Legal entity decision.** A UAE entity unlocks Stripe and GCC credibility. A PK/EG entity forces Paddle.
3. **Meta:** business verification → Tech Provider App Review (start in week 1; it's the longest approval) → BSP partner if card-less markets.
4. **Google** sensitive-scope verification, **Microsoft** publisher verification, **Shopify Partner** account, **Paddle** approval.
5. **Legal docs:** ToS, privacy policy, DPA + subprocessors; legal review of the Chatwoot MIT white-label.
6. **Team:** 1 full-stack TypeScript dev (platform), 1 dev comfortable running Rails/Chatwoot in production, part-time designer (RTL/Arabic), a founder doing sales and interviews.
7. **Realistic MVP timeline:** ~12–16 weeks for one country and one vertical. Meta and Shopify approvals run in parallel.
