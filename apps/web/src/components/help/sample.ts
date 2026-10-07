/**
 * Northwind Home's Help Center (decided 2026-10-07): categories, articles in several languages, and the gaps the
 * team should fill. Article text is the business's own content and stays as written in every interface language.
 * Bodies use a tiny markup: blank lines between paragraphs, "## " for headings, "- " for list items.
 */

/** Site languages. English only in the demo (decided 2026-10-07); add a code here to offer another. */
export type HelpLang = "en";
/** Languages a business can add to its help site (each article then gets a version per language). */
export const ADDABLE_LANGUAGES = ["Spanish", "French", "German", "Portuguese", "Japanese"];

export interface ArticleVersion {
  title: string;
  body: string;
  /** Drafted by AI from another language; a person must review it before it can be published. */
  aiDraft?: boolean;
}

export interface Article {
  id: string;
  slug: string;
  category: string;
  status: "draft" | "published";
  author: string;
  updatedDaysAgo: number;
  views: number;
  helpful: { yes: number; no: number };
  versions: Partial<Record<HelpLang, ArticleVersion>>;
}

export interface Category {
  id: string;
  name: string;
  description: string;
}

/** A topic's name and description as the site shows them (English only today; per-language names come with languages). */
export const topic = (c: Category) => ({ name: c.name, description: c.description });

export const HELP_SITE = { name: "Northwind Home Help", domain: "help.northwindhome.com", color: "#006ACC", languages: ["en"] as HelpLang[] };

export const CATEGORIES: Category[] = [
  { id: "shipping", name: "Shipping and delivery", description: "Where we ship, how long it takes and tracking." },
  { id: "returns", name: "Returns and warranty", description: "Returning something, repairs and the 2-year warranty." },
  { id: "care", name: "Product care and setup", description: "Setting up and looking after lamps, speakers and purifiers." },
  { id: "orders", name: "Orders and payment", description: "Paying, changing an order and invoices." },
  { id: "wholesale", name: "Wholesale and trade", description: "Trade prices, pallets and business accounts." },
];

export const ARTICLES: Article[] = [
  {
    id: "a1",
    slug: "where-do-you-ship",
    category: "shipping",
    status: "published",
    author: "Priya",
    updatedDaysAgo: 12,
    views: 4_812,
    helpful: { yes: 391, no: 22 },
    versions: {
      en: {
        title: "Do you ship to my country?",
        body: "We ship to 40 countries across Europe, North America, the Middle East and Asia.\n\n## Delivery times\n\n- UK and EU: 2 to 4 working days\n- USA and Canada: 3 to 6 working days\n- Middle East and Asia: 5 to 7 working days\n\nShipping is free on orders over $150. Below that, you'll see the price at checkout before you pay.\n\nIf your country isn't listed at checkout, write to us and we'll check whether we can arrange a delivery.",
      },
    },
  },
  {
    id: "a2",
    slug: "order-says-delivered",
    category: "shipping",
    status: "published",
    author: "Priya",
    updatedDaysAgo: 30,
    views: 1_955,
    helpful: { yes: 140, no: 31 },
    versions: {
      en: {
        title: "My order says delivered but it isn't here",
        body: "Sometimes a courier marks a parcel delivered a little early, or leaves it with a neighbour or in a safe place.\n\n## Please check first\n\n- Around your door, porch and any safe place you use\n- With neighbours and your building's reception\n- The tracking page for a photo or a signature\n\nStill nothing after 24 hours? Contact us with your order number. We open a check with the courier and send a replacement if it can't be found.",
      },
    },
  },
  {
    id: "a3",
    slug: "returns",
    category: "returns",
    status: "published",
    author: "Leo",
    updatedDaysAgo: 8,
    views: 3_120,
    helpful: { yes: 288, no: 15 },
    versions: {
      en: {
        title: "How do I return something?",
        body: "You can return anything within 30 days of delivery, unused and in its box.\n\n## How to return\n\n- Start a return from your order page or ask us in chat\n- Print the label we send, or show the QR code at a drop-off point\n- Your refund arrives 3 to 5 days after we receive the parcel\n\nReturns are free in the EU, UK and US. Elsewhere, the return shipping is deducted from the refund.",
      },
    },
  },
  {
    id: "a4",
    slug: "warranty",
    category: "returns",
    status: "published",
    author: "Priya",
    updatedDaysAgo: 45,
    views: 1_402,
    helpful: { yes: 97, no: 9 },
    versions: {
      en: {
        title: "What does the 2-year warranty cover?",
        body: "Every product has a 2-year warranty from the delivery date.\n\n## Covered\n\n- Faults in materials or manufacturing\n- Parts that stop working with normal use, like a fan unit or a power adapter\n\n## Not covered\n\n- Damage from drops, water or the wrong power supply\n- Normal wear, like scratches or faded fabric\n\nTo make a claim, send us your order number and a short video of the fault.",
      },
    },
  },
  {
    id: "a5",
    slug: "pair-pebble-android",
    category: "care",
    status: "published",
    author: "Priya",
    updatedDaysAgo: 2,
    views: 640,
    helpful: { yes: 51, no: 12 },
    versions: {
      en: {
        title: "Pebble speaker won't pair with Android 15",
        body: "After the September firmware update, some Android 15 phones can't pair with the Pebble speaker. A fix ships this week.\n\n## Until then\n\n- Turn the speaker off\n- Hold the play button and turn it back on, keeping play pressed for 5 seconds\n- Forget the speaker in your phone's Bluetooth settings, then pair again",
      },
    },
  },
  {
    id: "a6",
    slug: "breeze-filters",
    category: "care",
    status: "published",
    author: "Leo",
    updatedDaysAgo: 60,
    views: 2_210,
    helpful: { yes: 170, no: 18 },
    versions: {
      en: {
        title: "When should I replace the Breeze filter?",
        body: "Replace the filter every 6 months, or sooner if the filter light turns orange.\n\nReplacement filters are $24.90, or $44.90 for two. You can also subscribe and we'll send one every 6 months.",
      },
    },
  },
  {
    id: "a7",
    slug: "pay-in-instalments",
    category: "orders",
    status: "published",
    author: "Marcus",
    updatedDaysAgo: 20,
    views: 880,
    helpful: { yes: 60, no: 4 },
    versions: {
      en: {
        title: "Can I pay in instalments?",
        body: "Yes. Orders over $200 can be paid in 3 interest-free instalments with Klarna. Choose Klarna at checkout.",
      },
    },
  },
  {
    id: "a8",
    slug: "trade-account",
    category: "wholesale",
    status: "published",
    author: "Marcus",
    updatedDaysAgo: 14,
    views: 512,
    helpful: { yes: 33, no: 2 },
    versions: {
      en: {
        title: "Opening a trade account",
        body: "Interior designers, hotels and shops get trade prices and pallet shipping.\n\n## What you need\n\n- Your company name and VAT or tax number\n- An estimate of yearly volume\n\nApply from the Wholesale page and our sales team replies within one working day.",
      },
    },
  },
  {
    id: "a9",
    slug: "jp-adapter",
    category: "care",
    status: "draft",
    author: "Leo",
    updatedDaysAgo: 0,
    views: 0,
    helpful: { yes: 0, no: 0 },
    versions: {
      en: {
        title: "Power adapters for Japan",
        body: "Halo lamps ship with a universal adapter. For Japan, use the type A plug in the box.\n\nIf yours is missing, tell us your order number and we'll send one free.",
      },
    },
  },
];

/** What customers looked for and didn't find, and what the team keeps answering by hand. */
export const GAPS = {
  noResults: [
    { query: "cancel order", count: 41 },
    { query: "gift wrap", count: 23 },
    { query: "assembly instructions nook shelf", count: 17 },
    { query: "student discount", count: 9 },
  ],
  repeated: [
    { question: "Can I change the delivery address after ordering?", count: 14, from: "Leo, Priya" },
    { question: "Do the lamps work with smart home apps?", count: 11, from: "Marcus" },
  ],
};

/** Articles that share words with a customer's message: the AI's first shortlist. */
export function suggestArticles(text: string, lang: HelpLang = "en", limit = 2) {
  const words = new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3));
  return ARTICLES.filter((a) => a.status === "published" && a.versions[lang])
    .map((a) => {
      const v = a.versions[lang]!;
      const hay = `${v.title} ${v.body}`.toLowerCase();
      return { a, score: [...words].filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .map((x) => x.a);
}

/** The version customers may read: published, in that language, and not an unreviewed AI draft. */
export function liveVersion(a: Article, lang: HelpLang) {
  const v = a.versions[lang];
  return a.status === "published" && v && !v.aiDraft ? v : undefined;
}

/** What "Draft with AI" returns per article and language in the preview. Empty while the site is English only. */
export const AI_DRAFTS: Record<string, Partial<Record<HelpLang, ArticleVersion>>> = {};
