# Product Decisions

_Decided with the founder in question rounds starting 2026-09-27. Each line is a rule the product and the code must follow. ⚠ marks a decision that carries a known risk; the risk is written next to it._

## 0. Principles
- **Ease of work first.** Target users run hectic businesses. Every flow should take the fewest steps possible, with sensible defaults, plain words and no setup before value.
- **Everything at launch, quality first, no fixed date.** Built by the founder with Claude Code. A **private beta** for deposit-paying leads starts once the core (inbox, handoffs, CRM) works, around week 10–12, and features switch on as they're ready.

## 1. Conversation ownership and routing
- **Holder away:** if the holder is offline and the customer has waited longer than the workspace's wait limit (default 15 min in working hours), the conversation returns to the holder's team queue. The former holder becomes a read-only follower.
- **Team handoff:** a lead can be handed to a team. It enters that team's queue and the first person to click Claim becomes the holder. The handoff note is still required.
- **Returning customer:** a message within 7 days of resolution reopens the chat with the last holder. After 7 days, it goes through routing rules.
- **Unknown number:** routing rules decide first: keywords, the ad clicked, or the number written to. Unmatched chats go to the workspace's default team queue.
- **Handoffs:**
  - the customer sees one number, one chat and no staff names;
  - only the holder can reply;
  - the note must be at least 10 characters and is pinned for the new holder;
  - previous holders follow read-only;
  - the deal owner stays separate from the chat holder.

## 2. Visibility and permissions
- **Chat visibility:** agents see all conversations of their teams but can reply only to those they hold. Managers see their teams; the owner sees everything.
- **Money:** deal values and revenue are visible to the Owner and Sales roles only. Other roles see that a deal exists and its stage. Custom roles can change this.
- **Owner override:** the owner, and any role given this right, can reply in any chat without taking it over. The holder is notified and keeps the chat, and the reply is attributed to the owner internally.
- **Phone replies:** messages sent from the WhatsApp Business app are attributed to the member set in settings as the phone user ("Khalid, sent from phone"). This can be changed at any time.

## 3. AI
- **Suggestions:** reply suggestions appear only when someone clicks "Suggest reply" and are metered against AI credits.
- **Auto-reply:** off by default. A workspace can allow AI to answer **outside working hours only**, from approved business knowledge, always saying a person will follow up. Each reply is a billable Meta message and is shown as AI-sent.
- **Knowledge sources:**
  - the store catalogue (Shopify/Woo: products, prices, stock);
  - business info from settings (hours, locations, delivery areas, policies);
  - uploaded documents;
  - past conversations of **that workspace only**, retrieved at the moment of a suggestion. No model training, no sharing between workspaces, zero-retention API.
- **At launch:** AI-drafted handoff notes (editable), auto-tagging by topic (feeds routing), and translation of incoming Arabic, Urdu and Hindi plus outgoing replies.
- **Not at launch:** lead scoring.

## 4. Campaigns
- ⚠ **Audience:** any imported list is allowed, with a ban-risk warning. **Risk:** WhatsApp's Business Policy requires opt-in, and campaigns to cold lists are the most common cause of quality drops and number restrictions. This conflicts with our "no bans" promise.
- **Guardrails chosen:**
  - campaigns to imported lists need a **consent source** (in-store, website, event, other), stored for audits;
  - they also need **owner approval** before sending.
- ⚠ **Not chosen:** automatic pause on a quality drop, and ramp-up sampling for new lists. **Risk:** a bad list can damage the number mid-send. Revisit after pilots.
- **Campaign replies:** they go to the customer's current holder if there is one. Otherwise they go to the team chosen on the campaign.
- **Opt-out:** "STOP", "إيقاف", "unsubscribe" or the template's opt-out button opts the contact out of marketing instantly, and they get a confirmation. Service messages still work.
- **Frequency cap:** 2 marketing messages per contact per 7 days by default, adjustable by the owner. Skipped contacts are reported.

## 5. Channels and contacts
- **WhatsApp numbers:** several per workspace, by plan (Starter 1, Growth 2, Business 5). Each number can belong to a team.
- ⚠ **Contact matching is always manual.** A customer on WhatsApp and email appears as two contacts until staff merge them. **Risk:** the "one customer, one timeline" promise depends on staff merging. Show a visible "Merge contacts" action; revisit auto-linking on exact phone or email match after pilots.
- **Channels after launch:** Instagram DMs, Facebook Messenger, website chat widget, Telegram and SMS. Order to be decided from pilot demand.

## 6. CRM
- **Pipelines:** several, one or more per team. Starter gets 1; Growth and Business are unlimited.
- **Closing deals:** Won requires a final value. Lost requires a reason from a list: price, stock, went silent, competitor, other.
- **Lead source:**
  - Click-to-WhatsApp ad (from Meta's referral data; also flags the free 72-hour window);
  - tagged wa.me links and QR codes;
  - campaign replies;
  - a manual source field.
- **Quotes:** built from products (Shopify/Woo or a price list) and sent as PDF on WhatsApp or by email.
- **Invoices:** created as drafts from won deals and **pushed to the business's accounting software** (Zoho Books, QuickBooks, Xero), which handles VAT and UAE e-invoicing. We do not issue tax invoices ourselves. ⚠ Research the UAE e-invoicing mandate's dates and scope before building.

## 7. Onboarding and billing
- **Number admin:** only the Owner can connect, reconnect or remove WhatsApp numbers and see Meta billing. Disconnecting needs a confirmation step.
- **Trial:** 14 days with no card, **starting when the business connects its first WhatsApp number** (decided 2026-09-29), not at sign-up. Until then the account is free and unlimited in time, so early sign-ups during Meta's review lose nothing. Onboarding guides the owner to add a card on Meta's side, which is needed to send messages from 1 Oct 2026.
- **Seats:** a paid seat is any member who can reply or edit. Read-only viewers are free, up to 5 per workspace.

## 8. Data, privacy, audit
- **Retention:** kept until deleted. The owner can choose automatic deletion after 1, 2 or 5 years, and can purge media older than 1 year separately.
- **Erasure:** the owner can erase a contact, which deletes their messages, media, notes and deals. An audit entry records that an erasure happened, without the data. We tell the business that Meta's copy is outside our control.
- **Audit log:** handoffs, permission changes, exports, erasures and number changes are logged. Only the owner can view and export the log.

## 9. Hours, reply targets, notifications
- **Working hours:** set per team (e.g., Sales Sat–Thu 9–21, Support 24/7). UAE public holidays are preloaded and editable. Ramadan hours can be set as a date range.
- **Reply targets:** per team, first reply within X minutes in working hours. Over-target chats are flagged on the manager's home and the holder is reminded. No escalation chains.
- **Notifications:**
  - browser notifications;
  - push via the installable web app (PWA), on Android and on iOS 16.4+;
  - a daily email digest for managers;
  - WhatsApp alerts to a staff member's own number: urgent only (over target, or handed over while away), opt-in per person, capped per day, one billable Meta message each.
- **Staff mobile:** a desktop-first web app that works on phones and installs to the home screen. No native apps at launch.

## 10. Store and calendar
- **Store matching:** Shopify/Woo orders attach to a contact with the same phone or email. Orders are data, so this is not a contact merge. Customers who don't match become store-only records that staff can link.
- **Order status updates:** automatic utility templates when an order is confirmed, shipped or delivered. Configurable per workspace, with the Meta cost shown.
- **Calendar:** each member connects their own Google or Outlook calendar, synced both ways. Timed tasks and bookings appear there, and moving an event updates the task.

## 11. Homes, branches, languages
- **Manager homes:** the layout is fixed per role template. Managers can hide, show and reorder sections, but can't build their own widgets.
- **Branches:** each branch is a team with its own number(s), hours and staff. The owner sees all branches; branch managers see their own.
- **App language:** each member picks English or Arabic for their own interface. Customer messages always show as written.
- **Reply languages at launch:** templates and auto-replies in English, Arabic, Hindi and Urdu.

## 12. When things go wrong
- **Offboarding:** removing a member opens a reassign step for their chats, deals and tasks, to a person or a team queue. Access ends immediately, and their history stays attributed to them.
- **Number disconnect (14 days without opening the WhatsApp app):**
  - from day 10, in-app and email reminders to the owner;
  - if it disconnects, a banner blocks sending, explains why and guides reconnection;
  - messages from the gap are fetched where Meta allows.
- **Lapsed subscription:** 7 days of reminders with full access. After that the workspace is read-only: messages still arrive, nobody can reply. Data is kept 90 days.
- **Failed sends:** an inline "Not delivered" with the reason in plain words and the next step, and the holder is notified. WhatsApp never confirms a block, so the copy says: "Couldn't be delivered. The customer may have blocked your number or no longer uses WhatsApp."

## 13. Teamwork and automation
- **Collisions:** live presence ("Omar is viewing", "Omar is typing"). Replying to an unclaimed chat claims it. A second sender is blocked with "Omar just claimed this chat."
- **Collaboration:**
  - @mentions in internal notes, which grant read access;
  - approval requests (e.g., "Approve 8% discount"), approved or declined in the chat and logged on the deal;
  - **collaborators** the holder adds, who can reply for a limited time, as an exception to "only the holder replies";
  - a **private staff chat** per conversation, separate from notes.
- **Automations:**
  - route and assign by keyword, ad, number, tag or language;
  - auto-replies (out of hours, welcome, holiday notice);
  - CRM actions (create a deal or task, move a stage, tag);
  - store triggers (order placed, paid, shipped, abandoned cart).
- **Selling tools in chat:**
  - order status updates;
  - product cards from the catalogue;
  - payment links (Stripe, Tabby, Tamara) that update the deal or order when paid;
  - quote PDFs;
  - a location pin and booking slots from the calendar.

## 14. Reports and onboarding
- **Reports:**
  - team performance (chats, first reply, resolution, handoffs);
  - sales (pipeline by stage, won/lost with reasons, conversion by lead source);
  - campaigns and Meta cost.
- **Report sharing:** CSV export, one-page PDF, scheduled email, and an optional daily summary to the owner's WhatsApp (one Meta message a day).
- **Onboarding:** a 5-step guided checklist on the owner's home, each step skippable with progress saved:
  1. connect WhatsApp;
  2. invite the team and pick roles;
  3. set hours;
  4. import contacts;
  5. connect store and email.
- **Import:**
  - CSV/Excel with column matching and a duplicate preview;
  - WhatsApp history through coexistence (up to 6 months of 1:1 chats and contacts);
  - Shopify/Woo customers;
  - exports from HubSpot, Zoho, Wati and WAManager.

## 15. API and security
- ⚠ **A full public API at launch**, plus webhooks. **Risk:** a large surface to document, version and support. Every endpoint must enforce the same role permissions as the app. Consider marking it beta at launch.
- **Security:**
  - two-factor login (authenticator app or email code), which the owner can require for everyone;
  - login alerts and an active-sessions view with sign-out;
  - export controls: only chosen roles can export, and every export is logged.
- **Sign-in:** email + password, magic link, Google/Microsoft, and a phone code via WhatsApp (one billable authentication message each time).
- **Bulk export** of all contacts and chats is owner-only, logged, and delivered to the owner by email.

## 16. Plans and pricing
- **Price model:** per workspace, with seats and WhatsApp numbers included in each plan and extra seats at a set price.
- **Prices:** AED 99 / 249 / 499 are **placeholders**. Final prices are to be set later.
- **Higher plans only:**
  - custom roles (Growth and up);
  - AI after-hours auto-reply (Growth and up);
  - the full API (Business only);
  - branches, meaning several teams each with its own number (Business only).
- **AI billing:** monthly credits per plan plus paid top-ups. One suggestion or translation costs 1 credit; a summary, 2; an auto-reply, 3. Unused credits don't roll over.

## 17. Message templates
- **Authors:** the Owner, Sales and Support managers create and submit templates. Agents use approved ones only.
- **Approval help:**
  - a ready-made library (order update, appointment and payment reminders, follow-up) in English and Arabic;
  - a category check that warns when a "utility" template reads as marketing;
  - AI writing help;
  - rejection reasons explained in plain words, with a suggested fix.
- **Languages:** each template can have English, Arabic, Hindi and Urdu versions. The version is picked automatically from the contact's language, and staff can override.
- **Cost display:** the Meta cost is shown before every send: per message in the composer ("about AED 0.06") and as an estimated total per campaign.

## 18. Customer fields, segments, tags
- **Built-in fields:**
  - preferred language;
  - emirate/area;
  - company and job title;
  - birthday and gender (optional, personal data);
  - customer type (individual, business, VIP).
- **Segments:** saved point-and-click filters that update themselves (tags, last order date, spend, language, source).
- **Custom fields:** typed (text, number, date, dropdown, yes/no, AED amount), and optionally required when creating a contact or deal.
- **Tags:** managers create them; everyone applies existing ones.

## 19. Email
- **Mailboxes:** shared team mailboxes (sales@, support@) land in the shared inbox. Personal mailboxes are private by default, and the person chooses which threads to share to a contact's timeline.
- **Gmail while send-only:** each workspace gets a capture address, and sent mail BCCs it. A guided Gmail forwarding rule sends customer replies there, so threads land in the inbox without Google's restricted scopes.
  - Needs an inbound email service (e.g., Amazon SES or Postmark).
  - Needs a one-time forwarding confirmation in Gmail.
- **Signatures:** the owner sets a company signature template, and each member's details fill it in.
- **Email and WhatsApp stay separate conversations** because their rules, windows and costs differ. They sit on one contact's timeline once contacts are merged.

## 20. Orders & Delivery pack
- **Orders:** one order list with many sources: orders taken in chat, Shopify/Woo orders the store doesn't ship itself, and won deals converted to orders. Each shows its source.
- **Riders:** a daily WhatsApp link, no account, no seat, managed by Operations.
- **At launch:** dispatch board, rider page, cash handover, courier booking (Quiqup, Aramex), live rider location, and proof of delivery (photo and/or signature).
- ⚠ **Live location has gaps.** Without a native app, the browser shares location only while the rider page is open on screen; iPhones stop when the screen locks. Show "last seen" times honestly. Exact tracking would need a small native rider app later.
- **Availability:** an add-on on any plan. Riders are free.

## 21. Loose ends
- **Bookings:** simple slots sent in chat from the staff member's calendar. The customer picks one in WhatsApp, and it goes on the calendar with a reminder template. A full Bookings pack is not planned.
- **Customer ratings (CSAT):** optional and off by default. A one-tap rating goes out after a chat is resolved, at most once per customer per week, as a billable message.
- **Spam:** staff mark a chat as spam, which hides it. Future messages go to a Spam folder, and the number can be blocked through the Cloud API. History is kept.
- **Currency:** AED everywhere at launch. Every amount is stored with a currency code, so SAR, PKR, INR and others can be added later without rework.

## Open items
- Research the UAE e-invoicing mandate's scope and dates before building the accounting sync.
- Contact merging is manual (§5), so update the design-system inbox demo: Mariam's email and WhatsApp should show a "Possible duplicate" state, not an already-merged timeline.
- Re-plan the engineering plan by milestones for the founder + Claude, with the private beta at the core milestone.
- Set final prices (placeholders now) after talking to the deposit-paying leads.
- Choose the inbound email provider for the Gmail capture address.

## Relay pivot (2026-10-07)

The product is now **Relay**. It is for a global market and is omnichannel, with 18 channels; see `apps/web/src/components/channels/catalog.ts`. The new identity is Geist type, a flat Petrol accent and the "arcs" mark.

The omnichannel inbox (step 2) is built on these decisions:

- **Demo business:** Northwind Home, a global online consumer brand selling home goods and small electronics, priced in USD.
- **Sidebar:** Chatwoot style. Conversations come first, then one entry per connected inbox (each number or address), then teams and labels.
- **Per-channel rules are real, not cosmetic:**
  - Email has a subject, CC and quoted threads.
  - WhatsApp has the 24-hour window and templates.
  - Instagram shows story replies.
  - Voice shows call logs and recordings.
  - Slack and Discord have threads.
- **Conversation side panel:** contact details with all their channels, previous conversations across channels, linked deals, orders and tasks, and the AI summary and copilot.
- **Same person on two channels:** Relay suggests "looks like the same person" and an agent confirms the merge. There is never a silent auto-merge.
- **Reply via:** an agent can answer on another of the contact's known channels from the composer. This starts a linked conversation, which is useful when the WhatsApp 24-hour window has closed.
- **Broken channel** (expired token, bounced domain, flagged number), shown in three places:
  - a banner in that inbox with Reconnect;
  - an item on the owner's home under "Needs you now";
  - a composer that says it can't send there and offers another channel.

### Time zones and channels (2026-10-07)

- **Time zones:** each person sees times in their own zone. It's set in their profile and detected from the browser at sign-up. Reports, business hours and SLAs use the workspace's zone.
- **Channels page:**
  - Connected inboxes come first, with health and quick settings.
  - Below them, the catalogue of all 18 channels, grouped into Messaging, Social, Web, Work and Developer.
- **Connect flows:**
  - WhatsApp, website chat, email, Instagram and Messenger each get their own step-by-step flow.
  - Website chat's flow includes a live widget preview and the install code.
  - Email's flow covers forwarding and SMTP.
  - The other 13 channels share one "connect with your account" flow.

### Contacts (2026-10-07, step 4)

**Areas:**
- **One person, every channel:** all of a contact's identities in one place, with merged history and merge suggestions.
- Segments and CSV import.
- Companies.
- Privacy tools.
- Activity and notes.
- Custom fields and tags.
- Ownership and lifecycle.
- Bulk actions.

**Companies:** each contact belongs to at most one company. The company page lists its people, plus all their conversations, deals and orders. Matching by email domain is suggested, and a person confirms it.

**Import:** a review step. Exact matches on email or phone update the existing contact. Likely matches are listed so a person can merge them or keep them apart. Nothing is overwritten silently.

**Privacy, at production level:**
- Marketing consent per channel, with date and source. Campaigns respect it.
- A global "do not contact" flag.
- One-click export of everything held about a person.
- Erase on request (owner or admin, with a typed confirmation). The audit log records that it happened, without the data.
- Workspace retention rules that auto-delete conversations after N months.

### Reports and SLAs (2026-10-07, step 5)

**Build order:** Reports, then SLAs, then Help Center, then Campaigns.

**Reports cover four areas:**
- **Conversations:** volume by channel, team and hour; first reply and resolution times; open backlog.
- **Team and agents:** workload, reply times, ratings and handovers for each person.
- **Satisfaction (CSAT):** ratings and comments by channel, team and agent.
- **Sales and campaigns:** pipeline, won value, and campaign delivery, replies and conversions.

**SLAs are policies, matched by team, channel and VIP:**
- Examples: VIP first reply within 15 minutes; email within 4 hours.
- The clock only counts business hours.
- A warning shows at 80% of the target. Breaches are flagged in the inbox and in reports.

**SLA details (2026-10-07):**
- **Targets in each policy:** first reply, next reply and resolution.
- **When the clock stops:**
  - While the team is waiting on the customer, meaning the last message was ours.
  - Outside business hours, measured in the workspace's zone.
- **Who hears about it:**
  - The person holding the chat: a warning at 80%, then an alert at breach.
  - The team's manager: an alert at breach, which also appears under "Needs you now" on their home.
  - Unclaimed chats that breach are reassigned to the next available teammate.
- **When several policies match:** the strictest target wins, separately for each of the three targets.

### Help Center (2026-10-07)

**What's included:**
- A public, branded help site with categories, search and articles. No login is needed.
- An article editor with drafts and published articles, categories, and who wrote what and when.
- Articles in several languages. AI drafts the translations and a person reviews them.
- Feedback and gaps:
  - "Was this helpful?" votes.
  - Searches that found nothing.
  - Questions the team keeps answering in chat.

**How AI uses it:** in the reply box and in the widget, AI suggests relevant articles. It drafts answers only from published articles, and links the article it used.

**Who publishes:** anyone on the team can draft. Owners, admins and managers publish.

### Accent colour: Petrol → Relay blue (2026-10-07)

The accent changed from Petrol #0A5670 to **Relay blue #006ACC** (dark mode #5AABFF with a near-black label).

**Why:** blue feels familiar to Chatwoot users. We use Chatwoot's hue (209°), deepened, rather than their exact #1F93FF, for two reasons:
- The exact blue fails our contrast rule: white text on it reaches only 3.15:1, and as text on the page only 2.93:1.
- Copying their exact brand colour is not what we want.

**Contrast:**

| Check | Light | Dark |
|---|---|---|
| Label on the primary button | 5.34:1 (white) | 7.31:1 |
| Blue as text on the surface | 5.34:1 (4.98:1 on the page background) | 7.33:1 |
| Text on soft chips | 4.63:1 | 5.36:1 |

**Related rules:**
- **AI** uses the same blue, always with the sparkle icon and the "AI" label. There is no second tint and no violet.
- **The hero band** is flat #0058AA in light and #0A4078 in dark. White text on it reaches 7.06:1, and 80%-white body text 5.12:1.
- **The "in transit" deal badge** is now neutral grey, so blue only ever means action or selected.
- **The sample "Wholesale" label** moved to teal #0E7490, so a label never looks like a selection.
