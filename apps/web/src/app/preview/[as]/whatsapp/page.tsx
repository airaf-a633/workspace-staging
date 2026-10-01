import Link from "next/link";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { GetReady } from "@/components/whatsapp/get-ready";
import { NumberList } from "@/components/whatsapp/number-views";
import { sampleNumbers } from "@/components/whatsapp/numbers";
import { PREVIEW_TEAMS, previewNow, previewScope } from "@/lib/preview";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("settings"))("whatsapp") };
}

export default async function PreviewNumbers(props: PageProps<"/preview/[as]/whatsapp">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const base = `/preview/${as}`;
  const isOwner = previewScope(as, "numbers.manage") !== "none";
  const before = sp.state === "before";
  const now = previewNow();
  const t = await getT("numbers");
  const teamName = (key: string) => PREVIEW_TEAMS.find((x) => x.id === `t-${key}`)?.name ?? t("noTeam");

  return (
    <SettingsFrame base={base} active="whatsapp" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader
        title={t("title")}
        description={isOwner ? t("description") : t("ownerOnly")}
        action={
          <Link href={before ? `${base}/whatsapp` : "?state=before"} className="text-sm font-medium text-primary hover:underline">
            {before ? t("seeConnected") : t("seeBefore")}
          </Link>
        }
      />
      {before ? (
        <GetReady teamsHref={`${base}/teams`} />
      ) : (
        <NumberList numbers={sampleNumbers(now)} teamName={teamName} base={base} isOwner={isOwner} plan={{ name: "Growth", max: 2 }} now={now} />
      )}
    </SettingsFrame>
  );
}
