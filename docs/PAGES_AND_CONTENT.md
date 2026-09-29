# Pages and Content Plan

_Draft 2026-09-29. Covers the public website, the app screens and the onboarding flow. Decided so far: comfortable density, device theme, side menu with labels (bottom bar on phones), Petrol accent, **real product screenshots** as imagery, and an **interactive demo** on the public site._

## Rules for all public pages (trust with busy owners)
- **No fake proof.** No invented testimonials, customer logos, star ratings or numbers. Add them only after real beta customers agree.
- **No partner badges until they're true.** "Meta Tech Provider" appears only after Meta approves us.
- **Say the limits up front.** Examples: Meta charges for messages, keeping the phone app turns off broadcast lists, Gmail is send-only at first. Surprises lose trust after sign-up.
- **One main action per page:** "Start free trial". The second action is always "Try the demo".
- **Imagery:**
  - real screenshots of the app with the Qamar Electronics sample data, cropped to the part being discussed, in light and dark;
  - no stock photos of people pointing at laptops, and no illustrations of chat bubbles.
- **Copy:** plain English, short sentences, the business's own words (customers, orders, team), no jargon. Arabic versions are written by a person, not machine-translated.

## 1. Public website

### 1.1 Home (landing page)
| # | Section | Content | Imagery |
|---|---|---|---|
| 1 | Hero | Headline (≤ 8 words) on the core promise, e.g. "Your whole team on one WhatsApp number". One line on who it's for (UAE businesses that sell on WhatsApp). "Start free trial" + "Try the demo". A note: "14 days free, no card". | Screenshot of the inbox with the Mariam handoff visible |
| 2 | The problem | Three short, recognisable pains: chats stuck on one phone; nobody knows who replied; customer details scattered across WhatsApp, email and spreadsheets. | None (text only) |
| 3 | How it works (a real sequence, so numbered) | 1. Connect your number and keep the WhatsApp app. 2. Invite your team and choose what each person sees. 3. Hand chats between people; the customer sees one business. | One small screenshot per step |
| 4 | Manager workspaces | Owner, Sales, Support and Operations each get their own home over the same data. | Screenshot of two homes side by side |
| 5 | Interactive demo | The live sample inbox: switch "Viewing as", hand over a chat, see the 24-hour rule. | The demo itself |
| 6 | Everything else, briefly | Customers and deals, email and calendar, Shopify/WooCommerce, AI help (always approved by a person), campaigns, reports. One line each, linking to Features. | Small icons only |
| 7 | Arabic, done properly | Right-to-left layout and per-person language. | Arabic screenshot |
| 8 | Honest pricing | Plan names with "from AED …" (placeholders until prices are set), "no markup on Meta fees", link to Pricing. | None |
| 9 | Questions | Meta fees, keeping the phone app (and what switches off), number bans (official API only), Gmail, data location (Frankfurt), cancelling. | None |
| 10 | Final call to action | "Start free trial" + "Talk to us on WhatsApp" (our own number, running on our own product). | None |
| — | Footer | Product, Pricing, Demo, Contact, Privacy, Terms, DPA, language switch. | — |

### 1.2 Features
One page with anchored sections, each a heading, 2–3 sentences, what it replaces, and one screenshot:
- Inbox
- Handoffs
- Manager homes
- Customers & deals
- Tasks & calendar
- Email
- Store
- AI help
- Campaigns
- Automations
- Reports
- Security & privacy

### 1.3 Orders & Delivery pack
Who it's for (businesses with their own riders), the day in the life (order, dispatch, rider link, cash handover), the rider page on a phone, pricing as an add-on. Imagery: the dispatch board and a rider phone screenshot.

### 1.4 Pricing
- **Plan cards:** seats, numbers, AI credits and what's included.
- **Packs** as add-ons.
- **"What Meta charges":** a small calculator where you enter messages per month and get an estimated Meta cost in AED.
- **Billing questions:** trial, cancelling, failed payments, VAT.

### 1.5 Demo
The full interactive demo, with guided prompts ("Try handing Mariam's chat to Omar"). No sign-up needed.

### 1.6 Contact / About
- **Contact:** WhatsApp click-to-chat (our number), email, and the company address once licensed.
- **About:** a short "why we built this", with no team photos until you want them.

### 1.7 Legal
Privacy, Terms, DPA (drafted), plus a subprocessor list that stays in sync.

## 2. App screens

Imagery inside the app: **none** except simple Phosphor icons in empty states. The app's "imagery" is the customer's own data.

### 2.1 Home (per role; layout fixed, sections reorderable)
- **First weeks:** the setup checklist (built).
- **Afterwards:**
  - **Owner:** needs attention; team today; revenue and pipeline (four numbers).
  - **Sales:** pipeline by stage; follow-ups due; leads handed to me.
  - **Support:** unassigned; over reply target; waiting on customer.
  - **Operations:** today's tasks and calendar; store orders to fulfil; pack status.

### 2.2 Inbox
- **List filters:** Mine, My teams, Unassigned, All (per permission), Spam.
- **Search.**
- **Three panes:** list, thread, customer panel. On phones, one pane at a time.
- **Every state from the design system:** holder, follower, override, claim, 24-hour window, phone reply, disconnected, imported, failed send.

### 2.3 Customers
- **List:** search, saved segments and tags.
- **Customer page, with tabs:**
  - Timeline (every chat, email, deal, task and order in one line);
  - Deals;
  - Orders;
  - Tasks;
  - Details (fields, company, language).
- **"Merge contacts"** is visible, since merging is manual.

### 2.4 Deals
Pipeline board, with a list view on phones. Won needs a value; Lost needs a reason. Money is hidden for roles that can't see it.

### 2.5 Tasks
Today, overdue, upcoming, done. Each task links to its customer and syncs with the owner's calendar.

### 2.6 Reports (M10)
Team, sales, and campaigns with Meta cost. Every report exports to CSV or PDF.

### 2.7 Settings (hub, built)
- **Team:** members; teams and branches; roles.
- **WhatsApp:** numbers and templates.
- **Inbox:** canned replies; labels; working hours and holidays; routing rules.
- **Connections:** email, calendar and store.
- **Account:** billing; security; data (export, erasure, retention); personal preferences (language, theme).

## 3. Onboarding flow
1. **Sign up:** name, work email, password (built). Terms and Privacy linked.
2. **Business name** (built). Proposed: one optional question, "What does your team look like?" (just me / sales and support / with delivery), which preselects role templates and suggests the Orders pack.
3. **Home checklist** (built). Every step is skippable, and progress is saved.
4. **Connect WhatsApp (M2.8):**
   - Before Meta's window opens, a plain summary of what changes:
     - broadcast lists turn off;
     - groups don't sync;
     - open the phone app at least every 14 days;
     - Meta needs a card on file.
   - Then Meta's own signup.
   - Then a progress screen: contacts syncing, then history importing (up to 180 days), with an estimate.
5. **Invite the team:** a suggested role per person, with the invite link copyable or sent by email.
6. **The first real moment:** "Send a message to your business number from any phone". It appears live, and the checklist ticks itself.
7. **Emails** (after an email provider is chosen): welcome; a day-3 tip; trial ending in 3 days; trial ended.

## Decisions (2026-09-29)
- **Language:** the public website launches in English first; Arabic follows. The app itself supports Arabic from M4.
- **Product name:** decided later. "Workspace" stays as the placeholder.
- **Team question at sign-up:** included, with 4 skippable choices: "Just me", "A small team (2–5)", "Separate sales and support", "We also deliver orders". Each quietly adjusts the setup checklist.
- **"Talk to us" contact:** a new, dedicated UAE business number, connected to our own product once M2.8 works. Email until then.
- **Website tone:** calm and practical. No hype words.
- **Landing page length:** medium, 8–10 sections, as in §1.1.
- **Home:** after setup, leads with a "Needs you now" list, then the four numbers.
- **Inbox default:** chats I hold first, then my teams' unassigned chats. Managers can switch to "All".
- **Time:** 24-hour clock, Dubai time ("14:05", "Yesterday", "Mon 28 Sep").
- **Confirmations for destructive actions:** an inline second step with a clearly labelled button. No pop-ups.

- **Hero headline:** "Run your business from WhatsApp, together".
- **Pricing on the site:** placeholder prices (AED 99 / 249 / 499, Orders pack +99), clearly labelled "Beta pricing, may change".
- **Main call to action:** "Start free trial" opens sign-up now. Honesty requirement: the page and the setup checklist say that connecting WhatsApp opens after Meta's approval.
- **Demo:** a guided inline preview on the landing page (hand a chat over), plus "Open the full demo" at /demo.
- **Imagery until M2 ships:** live, real components with sample data instead of screenshots, which are swapped in once the real inbox exists.

## Open questions
- The product name, which is needed before the public website goes live.
- Should the 14-day trial start only when WhatsApp can actually be connected, so early sign-ups don't lose trial days?
