import Link from "next/link";
import { SectionHeader, SettingsFrame } from "@/components/settings-frame";
import { GetReady } from "@/components/whatsapp/get-ready";
import { NumberList } from "@/components/whatsapp/number-views";
import { sampleNumbers } from "@/components/whatsapp/numbers";
import { PREVIEW_TEAMS, previewNow, previewScope } from "@/lib/preview";

export const metadata = { title: "WhatsApp numbers" };

export default async function PreviewNumbers(props: PageProps<"/preview/[as]/whatsapp">) {
  const { as } = await props.params;
  const sp = await props.searchParams;
  const base = `/preview/${as}`;
  const isOwner = previewScope(as, "numbers.manage") !== "none";
  const before = sp.state === "before";
  const now = previewNow();
  const teamName = (key: string) => PREVIEW_TEAMS.find((t) => t.id === `t-${key}`)?.name ?? "No team";

  return (
    <SettingsFrame base={base} active="whatsapp" isOwner={previewScope(as, "members.manage") !== "none"}>
      <SectionHeader
        title="WhatsApp numbers"
        description={isOwner ? "The numbers your customers write to. Open one for its health, routing, profile and costs." : "Only the owner can connect or change WhatsApp numbers."}
        action={
          <Link href={before ? `${base}/whatsapp` : "?state=before"} className="text-sm font-medium text-primary hover:underline">
            {before ? "See connected numbers" : "See this page before connecting"}
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
