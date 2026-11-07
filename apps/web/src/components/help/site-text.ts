import type { HelpLang } from "./sample";

/**
 * The public help site's own words. They follow the site's language (English today), not the Relay app
 * language, because this page belongs to the business and its customers.
 */
export const SITE_TEXT: Record<HelpLang, Record<string, string>> = {
  en: {
    search: "Search for answers",
    searchLabel: "Search the help center",
    noResults: "No articles match “{q}”. Try fewer words, or chat with us.",
    popular: "Popular articles",
    articles: "{n} articles",
    helpful: "Was this helpful?",
    yes: "Yes",
    no: "No",
    thanks: "Thanks for telling us.",
    sorry: "Sorry about that. Chat with us and we'll help.",
    updated: "Updated {days} days ago",
    updatedToday: "Updated today",
    related: "Related",
    stillNeed: "Still need help?",
    chat: "Chat with us",
    chatNote: "Opens the chat on northwindhome.com. In this preview nothing is sent.",
    back: "All topics",
    language: "Language",
    notTranslated: "This article isn't available in English yet.",
    poweredBy: "Help center by Relay",
  },
};

export const siteText = (lang: HelpLang) => (key: string, vars: Record<string, string | number> = {}) =>
  Object.entries(vars).reduce((s, [k, v]) => s.replace(`{${k}}`, String(v)), SITE_TEXT[lang][key] ?? key);
