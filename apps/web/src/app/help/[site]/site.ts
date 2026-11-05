import { notFound } from "next/navigation";
import { HELP_SITE, type HelpLang } from "@/components/help/sample";

/** Only Northwind Home's site exists in the preview. */
export function siteFor(site: string) {
  if (site !== "northwind") notFound();
  return `/help/${site}`;
}
/** The site language asked for in ?lang=, falling back to English (the only language today). */
export const langOf = (v: string | string[] | undefined): HelpLang => (HELP_SITE.languages.find((l) => l === v) ?? "en");
