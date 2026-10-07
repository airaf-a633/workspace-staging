> **Superseded 2026-10-07:** Relay is English-only for now (see PRODUCT_DECISIONS, "English-only product"). This file records the earlier Arabic work for reference.

# Arabic and right to left

Decided 2026-10-01: the website, the preview and the real app all switch between English and Arabic. The Arabic text is a **draft for checking layouts**. A native speaker reviews every line before a customer sees it.

## How a person picks a language

- **Preview and website:** the EN / عربي switch (preview bar, site footer, phone menu, password page). It's saved in a cookie on that device.
- **Real app:** Settings › Account › Your language. It's saved in the cookie and on the member's row (`members.locale`), so it follows them to a new device when they sign in.
- **Numbers stay Western digits** in Arabic (1,250, 14:05). Money reads "1,250.00 درهم". Dates use Arabic month names.

## Where the text lives

- `apps/web/src/i18n/messages/en.ts` holds every piece of interface text.
- `apps/web/src/i18n/messages/ar.ts` has the same keys. The build fails if a key is missing.
- **For the reviewer:** edit `ar.ts` only. Anything in `{curly braces}` is filled in by the app; keep it. Plural sets (`one`, `two`, `few`, `many`, `other`) follow Arabic counting: 1, 2, 3–10, 11–99, 100+.
- **After the review:** set `ARABIC_IS_DRAFT = false` in `i18n/config.ts`. That removes the "عربي (مسودة)" tag.

## What isn't translated, on purpose

- **People's own words:** customer messages, notes, names, deal titles, tags and team names show exactly as written.
- **Legal pages** (privacy, terms, DPA) stay in English with an Arabic notice above them. A lawyer reviews an Arabic version first.
- **Brand and plan names:** Workspace, Starter, Growth, Business, Shopify, Outlook.

## Rules for new screens

- **No sentences in components.** Add the text to both files and use `useT("section")` in client components or `await getT("section")` in server ones.
- **Dates, money and sizes** go through `useFormat()` / `getFormat()`, never `toLocaleString` with a fixed locale.
- **Spacing and position** use logical classes (`ms-`, `pe-`, `start-`, `end-`, `text-start`). Arrows that point "forward" get `rtl:rotate-180`.
- **People's text inside interface text** goes in as a `{value}`. The translator isolates it, so "12 x ThinkPad" keeps its order inside an Arabic sentence. A title shown on its own goes in `<bdi>`. A message body gets `dir="auto"`.
- **Things that happened** (chat events, timeline lines) are stored as data (who, what) and worded when shown, never as finished sentences.
- **Errors from server actions** travel as short codes (`?error=needName`), never as sentences, and never with personal data in the URL.

## Open points for the reviewer

- **Role names are masculine** ("مدير المبيعات"), even for Sara and Priya. Decide whether to use neutral forms or let the owner choose.
- **Product terms to settle once:** "تولي" (claim), "تسليم" (hand over), "مزعج" (spam), "صفقة" (deal).
- **The Arabic for "Mine" is "لي"**, shortened so the inbox view picker fits.
