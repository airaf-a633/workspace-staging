import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { ComingSoon } from "@/components/coming-soon";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("nav"))("customers") };
}

export default async function Page() {
  const t = await getT("comingSoon");
  const nav = await getT("nav");
  return (
    <ComingSoon title={nav("customers")} icon={<UsersThree size={40} />} heading={t("customers.heading")}>
      {t("customers.body")}
    </ComingSoon>
  );
}
