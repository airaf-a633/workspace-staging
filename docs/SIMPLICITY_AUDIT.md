# The "drunk grandma" test: simplicity checklist and audit

*Written 19 October 2026. Audited against the partner preview, where every screen exists. Fixes come after the backend steps.*

## What the test means for Relay

Someone who has never seen Relay, isn't technical, and isn't paying full attention should still be able to say three things within about 5 seconds on any screen:

1. **Where am I?**
2. **What needs me right now?**
3. **What do I press to do it?**

If they can't, the screen is asking them to think, and that cost lands on every user every day, not only on beginners. The research backs this up: even experts prefer plain, scannable screens. A Nielsen Norman Group study of scientists, IT managers and medical staff found they all wanted short, easy-to-scan information and rejected jargon. In their words, nobody has ever complained that a text was too easy to understand.

**How strictly to apply it**

| Area | How strict | Why |
|---|---|---|
| Home (every role), onboarding, empty screens | **Full** | First thing people see. A wrong first impression costs the trial. |
| Settings | **Full** | Used rarely, so nobody remembers how it works. Every visit is a "first" visit. |
| Contacts, Deals, Tasks, Reports, Campaigns, Help Center | **Full on the first view**, depth one click away | Show the common case; hide the rest behind one clear control. |
| Inbox | **Light touch** | Agents spend 8 hours a day here. Simplify words and the first view, but keep keyboard shortcuts and density for speed. Simple by default, faster with practice. |

## The checklist (12 rules)

Each rule comes from a primary source (listed at the end). Every screen should pass all 12.

**Words**
1. **Say it the way a customer would.** Use the words people already use, not ours ("late reply", not "SLA breach"). *(NN/g heuristic 2, plain language)*
2. **One name for one thing, everywhere.** If it's "chat" on Home it's "chat" in Settings. No word means two things. *(heuristic 4)*
3. **Every number explains itself.** A number always comes with what it means and whether it's good: "Customers wait 6 min for a first reply. Good." *(heuristic 1)*
4. **Sentences under about 15 words; one idea each.** *(plain language guidance)*

**What's on screen**
5. **One main thing per screen.** The most important item is the biggest and comes first (top left). *(heuristic 8; F-shaped scanning)*
6. **Show the common 80%; hide the rest behind one clearly labelled control.** Never more than two levels deep. *(progressive disclosure)*
7. **Each item states one status, not three.** Pick the one that matters most.
8. **Numbers must agree with each other.** If two counts on one screen look like they describe the same thing but differ, it reads as a bug.

**Doing things**
9. **One obvious next action.** Every list item and empty screen says what to press. *(heuristics 6, 10)*
10. **Recognise, don't remember.** Show choices instead of asking people to recall codes ("All / Team / Own"). *(heuristic 6)*
11. **Easy undo beats "are you sure?".** Confirm only things that can't be undone. *(heuristics 3, 5)*
12. **Errors say what happened and what to do next,** in plain words. *(heuristic 9)*

## Our words → plain words

The single biggest win. These terms appear across the app today:

| We say | A grandma would say | Notes |
|---|---|---|
| Claim / claimed | **Take** this chat / **took** it | "Claim" is support-desk jargon. |
| Holder | **Who's handling it** | Never show "holder" to users. |
| Agents (meaning AI) | **AI helpers** (or "Assistants") | ⚠️ Clash: "Agent" is also a *person's role* (Leo, Agent). On the owner's Home, "From your agents" means AI. Must fix. |
| Agent (role) | **Team member** | Keep "Agent" only if we drop it for AI. |
| First reply / Next reply / Resolve (targets) | **Answer within / Reply again within / Finish within** | Columns in Reply targets. |
| SLA, breach, overdue | **Late** / **due in 5 min** | "Reply targets" is already good. |
| Median | **Usually** ("Usually answered in 6 min") | Reports and Home. |
| Policies (reply targets) | **Rules** | |
| Segment | **List** or **Group** | Contacts. |
| Collaborator | **Helper** / "someone helping" | |
| Templates | **Approved messages** | WhatsApp-specific; add a one-line why. |
| Lapsed (stage) | **Hasn't bought in a while** | |
| Inboxes (sidebar) | **Channels** | We use both words for one thing (breaks rule 2). |
| PDPL | **Privacy law** / "permanently erase" | ⚠️ Leftover from the UAE version; wrong for a global product. |
| Credits | **AI uses** ("2,000 AI uses a month") | Pricing too. |

## Audit, screen by screen

Ranking: 🔴 high (confuses or misleads), 🟠 medium (slows people down), 🟢 low (polish).

### Home (every role)

- **Leo's (agent) Home is the model.** It has one list of people waiting, four plain numbers and nothing else. The other homes should look closer to it.
- 🔴 **Counts disagree on the owner's Home.** The header says "13 customers", the button says "See all 14", the AI briefing says "9 chats waiting to be claimed", and the number tile says "Unassigned chats 3". Four numbers that read as the same thing. *(rule 8)*
- 🔴 **"From your agents / Manage agents"** means AI helpers, but "agent" is a person's role elsewhere. *(rule 2)*
- 🟠 **Each waiting customer shows two or three statuses**, such as "Waiting 2 h 0 min · First reply overdue by 1 min · Nobody has claimed the chat". Show one: **"Late by 1 min · nobody's on it"**. *(rule 7)*
- 🟠 **The four AI cards (briefing, sales follow-up, support triage, after-hours) compete with "Needs you now".** Fold them into one AI card with the single most useful line; the rest go one click deeper. *(rules 5, 6)*
- 🟠 **"Median first reply 6 min · Target 30 min"** → **"You answer in about 6 min. Your goal is 30. ✓ Good."** *(rule 3)*
- 🟢 Instagram appears twice in its own row ("Instagram / Instagram is disconnected"). Say it once.

### Inbox (light touch)

- 🟠 **The sidebar shows three filter systems at once:** 13 channels, 3 teams and 6 labels, with counts. Default to **All / Mine / Waiting for someone**. Put channels, teams and labels under one "Filter" control (open for anyone who used it last time).
- 🟠 **The "Mine" tab shows 9, but includes chats nobody has taken yet.** Rename the tabs **Mine · Waiting for someone · Everything**, and count only what's truly in each.
- 🟠 **Jargon on rows:** "First reply overdue by 12 min" → **"Late by 12 min"**; "First reply due in 5 min" → **"Answer in 5 min"**.
- 🟢 Keep everything else. Shortcuts, density and the panel are what make agents fast.

### Contacts

- 🟠 **Five filter rows are visible before the list starts:** segment, tags, stage, channel and search. That's 76 controls on one screen. Show **search plus one "Filter" button**; open filters show as removable chips. *(rule 6)*
- 🟠 **The table has 7 columns.** On first view, keep Name, Last contact and Owner. Channels, stage and deal fit in the row as small badges or on the contact page.
- 🟢 **The stage name "Lapsed"** → "Hasn't bought in a while".

### Deals, Tasks, Campaigns, Help Center

- 🟢 **Generally fine.** These screens are 100–190 words and have clear structure.
- 🟠 **Deals: column headers carry three numbers** ("Negotiating · 3 · $17,430.00"). Keep the stage name and count; show the value on hover or in a total row.
- 🟠 **Every empty screen needs one sentence and one button**, e.g. "No deals yet. Add your first deal." Check them all when the real data arrives.

### Reports

- 🟠 **"Median first reply", "Median time to resolve" and "Within reply target"** → "Usually answered in", "Usually finished in" and "Answered on time".
- 🟠 **Twelve channel filter buttons** plus team and date filters → three dropdowns: *When · Team · Channel*.
- 🟠 **The "Busy times" heatmap shows raw numbers in 84 cells.** Lead with one sentence ("Busiest: weekdays 12:00–16:00") and keep the grid below for anyone who wants it. *(rule 3)*

### Settings (all sections)

- 🔴 **Eleven sections in one flat list.** Group them in three:
  - **You:** Account.
  - **Your team:** Members, Teams, Roles.
  - **Your business:** Channels, Labels, Contacts and privacy, Reply targets, AI, Billing.
- 🔴 **Account: the time zone menu lists 400+ raw codes** ("Africa/Abidjan", "America/Argentina/La Rioja"). Replace it with a search box that finds cities ("London", "Karachi") and defaults to the detected zone. Also, the setup checklist sits inside Account; it belongs on Home only.
- 🔴 **Roles: a 7-column × 30-row grid using codes ("All / Team / Own").** Nobody can read it.
  - **Fix:** one card per role with three plain sentences, e.g. "Agents answer chats for their team, take new ones, and see their own deals."
  - The full grid stays behind "Compare every permission".
  - A custom role is built by answering questions ("Can they see deal values?"), not by filling a grid. *(rules 6, 10)*
- 🔴 **Privacy: "Erase a contact (PDPL)".** PDPL is a UAE law; we're global. Say "Permanently erase a contact (privacy requests)".
- 🟠 **Channels: 13 connected channels and the full catalog of 18 on one 3,255px page.** Show the connected channels first; "Add a channel" opens its own step with search and the 5 most popular first.
- 🟠 **AI settings: 743 words and 7 sections on one page.** Split into three plain sections:
  - **What AI does for you:** the helpers, each with one on/off switch and one sentence.
  - **What AI knows about your business.**
  - **Usage and privacy.**

  Every number and log moves one click deeper.
- 🟠 **Reply targets:**
  - The columns "First / Next / Resolve" → "Answer within / Reply again within / Finish within".
  - "Policies" → "Rules".
  - The four alert thresholds (50/75/80/90%) → one choice: "Warn when a chat is getting close to late".
  - The example sentence already there is excellent; give every rule one.
- 🟢 Billing and Labels are already clear.

### Onboarding and first run

- 🟢 **Already good.** Three steps, one question per screen, every field optional except the name.
- 🟠 **"We also deliver orders: our own riders or drivers"** is left over from the delivery-business version. It's confusing for most global customers. Drop it, or move it into the "Something else" answers.
- 🟠 **The setup checklist shows on Home *and* in Account.** Keep one place (Home), and hide it once done.

## Fix plan, in order of impact

1. **Words pass, across the whole app** (one change in `en.ts`, touches every screen): apply the glossary above, fix the "agents" clash, and remove PDPL.
2. **Home:** make the numbers agree, one status per row, one AI card, and numbers that explain themselves.
3. **Settings:** group into You / Team / Business, add a city search for time zone, role cards instead of the grid, a separate step for adding channels, and AI in three sections.
4. **Lists** (Contacts, Reports, Inbox sidebar): search plus one Filter button, fewer columns, and summaries before charts.
5. **Empty screens and errors:** one sentence and one button each, checked as the real data arrives.

## Testing with real people (the real drunk-grandma test)

No checklist replaces watching someone. Do this before launch, and again after the fixes.

**Who:** 3–5 people who have never seen Relay. At least one should not be technical (a shop owner, a parent, a friend outside tech). Five people find most of the big problems.

**Setup:** the preview, on their own laptop or phone if possible. 20 minutes each. You watch and take notes; you never help.

**Say this first:** "We're testing the app, not you. You can't do anything wrong. Please think out loud: say what you're looking at and what you expect. I won't help, because I want to see where the app is unclear."

**Tasks** (read one at a time; don't use the words on the buttons):
1. "You've just opened this. In your own words, what is this screen telling you?" (Home, 30 seconds)
2. "A customer has been waiting the longest. Find them and start helping them."
3. "You need to pass that customer to someone in Sales, and tell them what's going on."
4. "Find the customer named Grace and see what she bought."
5. "You want new Instagram messages to go to the Support team. Change that."
6. "A new person, Sam, joined your team today. Give them access, but they shouldn't see sales numbers."

**Watch for:**
- Hesitation over 5 seconds.
- Hovering without clicking.
- Reading a word twice.
- Going to the wrong tab first.
- Saying "I guess…" or "Probably…".
- Asking you anything. Answer with "What would you expect?"

**After each task, ask:**
- "How easy was that, from 1 to 5?"
- "Was there any word you didn't understand?"

**Write down:** the exact words they used for things. Those are the words the app should use.

**What counts as passing:** each task done without help in under 2 minutes, with an ease score of 4 or more. Anything failing twice goes to the top of the fix list.

## Sources

- Nielsen Norman Group, [10 Usability Heuristics for User Interface Design](https://www.nngroup.com/articles/ten-usability-heuristics/)
- Nielsen Norman Group, [Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- Nielsen Norman Group, [Plain Language Is for Everyone, Even Experts](https://www.nngroup.com/articles/plain-language-experts/)
- Steve Krug, *Don't Make Me Think, Revisited* (New Riders, 2014): the origin of the "don't make me think" test
- Stripe, [Design your app](https://docs.stripe.com/stripe-apps/design): the Dashboard home "gives users a quick overview… and routes them to core workflows"
- Shopify, [the new admin](https://www.shopify.com/blog/admin-new-look), and the [merchant pushback](https://community.shopify.com/t/make-the-shopify-home-screen-more-useful/660605): a reminder that simplifying a home screen must not hide the numbers people check daily

*Note: many blog posts quote percentages ("reduces cognitive load by 55%" and so on) attributed to Nielsen Norman Group. I couldn't trace any of them to a primary source, so none are used here.*
