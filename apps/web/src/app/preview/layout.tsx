import type { Metadata } from "next";
import { getT } from "@/i18n/server";

// The design preview is public but shouldn't appear in search results.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT("preview");
  const meta = await getT("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("title")} · ${meta("name")}` },
    robots: { index: false, follow: false },
  };
}

export default function PreviewRoot({ children }: LayoutProps<"/preview">) {
  return children;
}
