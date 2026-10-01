import { Handshake } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("deals") };
}

export default async function Page() {
  const t = await getT("comingSoon");
  const nav = await getT("nav");
  return (
    <ComingSoon title={nav("deals")} icon={<Handshake size={40} />} heading={t("deals.heading")}>
      {t("deals.body")}
    </ComingSoon>
  );
}
