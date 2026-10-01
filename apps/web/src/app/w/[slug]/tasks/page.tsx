import { CheckSquare } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("tasks") };
}

export default async function Page() {
  const t = await getT("comingSoon");
  const nav = await getT("nav");
  return (
    <ComingSoon title={nav("tasks")} icon={<CheckSquare size={40} />} heading={t("tasks.heading")}>
      {t("tasks.body")}
    </ComingSoon>
  );
}
