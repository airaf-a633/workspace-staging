# Workspace (working name): Design System (Master)

_v0.2, 2026-09-27. The shared, browsable version with live components and demos is the "Order Desk Design System" artifact, now titled Workspace._ Tokens live in [tokens.css](tokens.css). This file explains the choices so later changes stay deliberate._

**Design read:** WhatsApp-first business workspace for UAE small businesses, where several managers (owner, sales, support, operations) share one number and one set of customer data. Calm and dense, built for glancing. shadcn/ui components, restyled with these tokens (never shipped in their default state).

**Dials:** variance 3 · motion 2 · density 8 for the dashboard. The rider page uses density 3: big targets, one task per screen.

## 1. Color

**One accent, Ink `#3E36B0` (under review against Plum `#7A2B6B` and Petrol `#0B5A6B`; see the design system's Brand colour options).** It was chosen by elimination, not taste:

| Hue | Why not |
|---|---|
| Green | WhatsApp and Careem own it; it also means "delivered" |
| Orange | Talabat |
| Yellow | Noon |
| Bright teal | Deliveroo |
| Blue | Generic SaaS default; reserved for the "in transit" status |
| Red | Reserved for "failed" |

Ink is the only hue left that doesn't clash with a local delivery brand or with order-status meanings. It appears only on primary actions, focus, and the current selection. Never as a gradient or glow.

**Status colors carry meaning and nothing else.** Each one always appears with a text label or icon, never color alone.

| Status | Light | Dark | Used for |
|---|---|---|---|
| New | `#5B5A6B` | `#A3A2B3` | New order, unassigned |
| Transit | `#1C62A0` | `#6CB2F0` | Assigned, picked up |
| Done | `#15703F` | `#4CC98A` | Delivered, cash matched |
| Warn | `#8F5200` | `#F2B24C` | Late, cash variance |
| Fail | `#B42A23` | `#FF8A80` | Failed, cancelled |

**Measured contrast (WCAG):**
- Body text on surface: 17.9:1 light, 15.0:1 dark.
- Muted text: 6.7:1 light, 7.0:1 dark.
- Status text on its soft badge background: at least 5.4:1.
- Input borders: 3.4:1.
- Focus ring: at least 7.3:1.

**Neutrals:** one cool-gray family throughout. No warm grays, and no pure black or white.

## 2. Type

**IBM Plex Sans + IBM Plex Sans Arabic + IBM Plex Mono.**
- **Why:** it's one superfamily, and the Arabic was drawn alongside the Latin (Khajag Apelian). Weights, x-heights and rhythm match when English and Arabic sit side by side in one row, which happens constantly: an Arabic customer name next to an English address.
- **Mono** is for every AED amount, order ID and time, using tabular figures so columns line up. This is the one typographic signature.
- **Sizes:**
  - Dashboard body: 15px; dense tables: 13px.
  - Rider page body: 16px minimum; rider buttons: 18px.
  - Nothing below 12px.
- **Arabic line height:** 1.7, versus 1.5 for Latin.
- **Loading:** self-host through `next/font` or `@fontsource`. Don't load from a Google Fonts `<link>`.

## 3. Shape, space, elevation

- **Radius rule:**
  - Controls (buttons, inputs): 8px.
  - Panels (cards, dialogs, sheets): 12px.
  - Pill shape: status badges only.
- **Spacing:** 4px base. Dashboard gaps mostly 8/12/16px.
- **Cards only for real hierarchy.** Tables and KPI rows sit on the surface, separated by 1px dividers.
- **Shadows:** two levels, tinted with the ink color. Level 2 is for popovers and dialogs only.

## 4. Motion

- **Durations:** 120ms for hover and press; 200ms for panels and toasts; ease-out.
- **What moves:** only state changes. A new order sliding into the board, a status badge changing, a toast.
- **What doesn't:** nothing loops, nothing animates on scroll.
- **Reduced motion:** all durations go to 0.

## 5. RTL rules

- Use logical CSS properties only: `ms-*`, `me-*`, `ps-*`, `pe-*`, `start`, `end`. Never `left` or `right`.
- Directional icons (arrows, chevrons, the "next step" rail) mirror in RTL. Clocks, maps and phone-number digits do not.
- Numbers and phone numbers stay left-to-right inside Arabic text: wrap them in `<bdi>`, or use `dir="ltr"` on the mono span.
- Test every screen in Arabic before calling it done.

## 6. Rider page overrides (Orders & Delivery pack)

- Always light theme, for sunlight.
- Primary buttons are 56px tall, full width, with a single action per screen.
- At most two actions visible at once, e.g. "Delivered" and "Couldn't deliver".
- Works on a 360px-wide Android in Chrome, on a slow 3G connection.

## 7. Signature element

**Now the handoff trail** (who has handled a conversation, current holder in `primary`). The order rail below belongs to the optional Orders & Delivery pack.

### Orders & Delivery pack: the order rail

**The order rail.** One horizontal strip of 5 stops (Placed → Assigned → Picked up → Delivered → Cash in) appears in the same form on the dispatch board, the order drawer, the customer's timeline and the rider page. It encodes the real lifecycle, so it's structure rather than decoration. Everything else stays quiet.

## 8. Icons

Phosphor icons (`@phosphor-icons/react`), regular weight, one family only. No emoji in the UI.

## 9. Scope note

The design-taste-frontend skill doesn't cover dashboards. It applies to the marketing site only, which gets its own page override later in `pages/marketing.md`.

## 10. Team-only surfaces

`note-soft` / `note-border` mark anything the customer never sees: internal notes and pinned handoff notes. Text on `note-soft` is 16.6:1 (light) and 13.1:1 (dark).
