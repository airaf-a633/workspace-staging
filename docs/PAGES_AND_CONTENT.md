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
- **Built (sample data):** `apps/web/src/components/inbox/`. Access rules are in `packages/domain/src/conversationAccess.ts` (tested), shared with M2.

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

- **Trial:** starts when the first WhatsApp number connects, not at sign-up.
- **Public site on phones:** a small menu button opens the section links.

- **Inbox before Meta approval:** sample chats come from a frontend mock, bound to the workspace's real members, teams and role permissions. Names that don't match a real member become sample teammates, who can't receive handoffs.
- **Inbox actions before Meta approval:** claim, hand over, notes, resolve, spam and tasks all work, but only for the browser session (reset on reload). Send shows "nothing was sent" until a number or mailbox is connected. A banner says so.
- **Testing states:** by signing in as each seed user (their real role decides holder, override, claim or follower). There's no "Viewing as" switch.
- **Inbox layout:** list and chat from 768px; the customer panel is closed by default and opens as a column from 1280px (the side menu is an icon rail in the Inbox), or as a sheet below that. Below that, one pane at a time. The open chat is kept in the URL (`?c=`), so Back returns to the list.
- **Customer panel:** contact, handoff history, open deals (value per permission), tasks and orders.
- **Shortcuts:** J/K, R, N, H, E, / and ?, taught in tooltips. Nothing depends on them.
- **Handoff:** an inline panel above the reply box, for a person or a team. The note needs 10 or more characters.

### Visual direction v2 (2026-09-30)
Reference: alliahealth.co. The first pass read as generic, next to the competitor wamanager.io.
- **Where it applies:** the public site gets the full treatment. The app takes the same fonts, colours and finish, but stays calm and scannable for all-day work.
- **Fonts:**
  - Fraunces, light (300), for display headings: large and tightly tracked.
  - Geist for all text and UI.
  - IBM Plex Sans Arabic for Arabic.
  - All three are free and loaded through next/font. Allia's PP Museum and PP Neue Montreal are paid, and have no Arabic.
- **Colour:**
  - Petrol #0A5670 stays the brand and action colour.
  - Soft atmospheric gradients from petrol into mint and pale sky.
  - Navy text instead of near-black.
- **Shapes:** a floating glass pill nav on the public site, and pill buttons.
- **Imagery:** the hero pairs a photo of UAE business people with live product pieces, which float on gradients in the sections. The photo source is still open.
- **Motion:** gentle. Sections fade and rise in once, the hero gradient drifts slowly, and hover eases. All of it is off with reduced motion.
- **Photos:** AI-generated (decided 2026-09-30). Brief and prompts: `docs/brand/IMAGERY.md`. Never presented as real customers.
- **Public site theme:** always light, whatever the device setting (decided 2026-09-30). The app follows the device. Implemented as a `.force-light` scope.
- **Text font:** Google Sans, from the founder's file (OFL), replaces Geist for text and UI. Geist stays in the stack as the per-letter fallback, because the file only covers Basic Latin and Latin-1.
- **Design system:** updated to v2 (Petrol, gradients, fonts, pill buttons, new cover) on 2026-09-30, version 9.
- **Decluttering pass (2026-09-30, after research into Front, Intercom and Linear):**
  - **Side menu:** in the Inbox it shrinks to a 64px icon rail; other pages keep the labelled menu.
  - **Customer panel:** closed by default and opened with a "Customer" button. It stays open while you move between chats. It shows only sections that have content; empty ones become small "add" links.
  - **List header:** one row, with a view menu (Mine, My teams, Unassigned, All, Spam) as the title, an Open/Resolved switch, and search behind an icon. Rows are two lines. Only states that need attention get a badge, and the channel icon appears only for email.
  - **Headers:** every pane's header is one 56px row, so they line up across panes.
  - **Thread:** day separators; small times in the text font; softer bubbles with no borders; messages grouped by person (5 minutes); the reply box is a floating card with a Reply/Note switch.
  - **Dark mode:** near-neutral charcoal surfaces. Petrol only for actions, selection and focus.
  - **Preview:** one slim bar. The inbox's sample note is a small line you can dismiss.
  - **Landing hero:** words, photo and one floating handoff chip. The interactive demo moves to its own section, at a fixed height.
- **Home and Settings pass (2026-09-30):**
  - **"Needs you now":** one row per customer, with that customer's items as small tags. Sorted by urgency, at most 5, with "See all" after that. Icons appear only on warn/fail rows.
  - **Real Home:**
    - Before WhatsApp connects, the setup checklist is Home.
    - After it connects, Home is the manager home. Unfinished setup shrinks to a small "Setup 3 of 5" link until it's done or dismissed.
  - **Settings:** one page with a side sub-menu (Team members, Teams and branches, Roles, WhatsApp numbers, Account). No hub page and no cards inside cards. Members is a plain list with "Invite" at the top, which opens an inline panel.
  - **Design system:** ConversationRow, Message, Composer and HandoffTrail get the new look. The Inbox and Manager homes demos are rebuilt from them.
- **Customers and WhatsApp numbers (2026-09-30):**
  - **Customers list:** a calm table (name and company, last contact with channel, deal stage and value per permission, tags, owner). Segments work as a view menu (All, Businesses, VIP, Open deal, No contact in 30 days), with tag chips and search. On phones the table becomes two-line rows.
  - **Add a customer:** a short inline form. Name and phone (with country code) are required; email, company and tag are optional. It checks for the same phone (last 9 digits) or email and offers to open that customer instead of creating a duplicate. Import sits beside it (soon).
  - **Customer page:** details on the side (contact, fields, tags, deals, follow-ups, orders total) and one timeline in the main column, with filter chips. "Open chat" and "New deal" sit at the top; merge and erase (owner, inline PDPL confirm) are in the ⋯ menu. A possible duplicate shows as a banner with "Compare and merge".
  - **Merge:** both records side by side. Pick values where they differ; timelines, deals, follow-ups, orders and tags combine. There's an inline confirm, the merge is logged, and it isn't undone automatically.
  - **WhatsApp numbers:** Settings lists each number (status, quality, team, the 14-day warning) with "Connect a number" (N of plan). Each number has its own page:
    - **Health:** the phone app's last-opened countdown, quality in words, and the daily limit.
    - **Routing:** the team, and where new chats go.
    - **Profile:** display name review, about, category, and a preview of what customers see.
    - **Usage:** counts by category, estimated Meta charges, and whether a card is on file with Meta.
    - **Disconnect:** at the bottom, behind a confirm, owner only.
  - **Before Meta approves us:** the numbers page is a get-ready checklist (verify the business, choose the number, card on Meta, teams). This is the real page today.
  - **Setup chip:** can be hidden for good (this browser for now; per member later). The checklist stays in Settings › Account.
- **Deals (2026-09-30):**
  - **Board:** New → Quoted → Negotiating. Won and Lost are outcomes, reached with Mark won (asks for the final value) or Mark lost (asks for a reason: price, stock, went silent, competitor, other). They're listed in the Closed view.
  - **Cards:** customer, what they're buying, value (per permission), and the owner's initial. One quiet line appears only when the deal needs something: a discount waiting for approval, a follow-up today or tomorrow, or no reply in N days.
  - **Columns:** each shows a count and a total. The total appears only for roles that see money.
  - **Moving deals:** drag between stages, or use the Stage menu in the side sheet (keyboard and phones).
  - **Views:** My deals, My teams, All deals. Each role opens on the widest view it has; agents see their own deals only.
  - **Side sheet over the board:** value, stage, owner, team, expected close, follow-up, approval, notes, then Mark won or Mark lost.
  - **Discount approvals:** shown on the card and in the approver's Needs you now; the link opens the deal. Approve or decline with an optional note. Approving applies the discount to the value.
  - **Phones:** the stage columns stack into one list.
- **Tasks (2026-09-30):**
  - **Layout:** one list grouped by when: Overdue (warn), Today, Tomorrow, This week, Later, No date, then Done collapsed.
  - **Each row:** a checkbox, what to do, the customer link, the due time or day, repeat, the calendar mark (Outlook/Google), notes, snooze, and the owner's initial.
  - **Quick add:** an inline row with chips: customer, when (Today / Tomorrow / Next week / pick a date, with an optional time), repeat, and owner (for managers). There's no sentence parsing.
  - **Completing:** undo for 6 seconds. Completing a repeating task creates the next one, and the toast says when.
  - **Snooze:** Later today, Tomorrow, or Next week.
  - **Notes:** short notes on a task, for the owner and their manager.
  - **Views:** everyone opens on My tasks. My team and All tasks group by person, with overdue counts.
- **/preview:** a public, noindexed area with a made-up Qamar workspace and a "Viewing as" switch. It covers Inbox, Home (manager homes), Settings, and Sign-up with onboarding. It has no database and no login, and the real `/w/` app keeps its guards.

## Open questions
- The product name, which is needed before the public website goes live.
