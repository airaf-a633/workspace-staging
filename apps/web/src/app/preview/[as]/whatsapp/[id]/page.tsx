import { notFound } from "next/navigation";
import { SettingsFrame } from "@/components/settings-frame";
import { NumberDetail } from "@/components/whatsapp/number-views";
import { sampleNumbers } from "@/components/whatsapp/numbers";
import { PREVIEW_TEAMS, previewMembers, previewNow, previewScope } from "@/lib/preview";

export const metadata = { title: "WhatsApp number" };

export default async function PreviewNumber(props: PageProps<"/preview/[as]/whatsapp/[id]">) {
  const { as, id } = await props.params;
  const now = previewNow();
  const n = sampleNumbers(now).find((x) => x.id === id);
  if (!n) notFound();
  const teams = PREVIEW_TEAMS.map((t) => ({ key: t.id.replace(/^t-/, ""), name: t.name }));
  const people = previewMembers().filter((m) => m.canReply && m.teams.includes(`t-${n.teamKey}`)).map((m) => m.name);
  return (
    <SettingsFrame base={`/preview/${as}`} active="whatsapp" isOwner={previewScope(as, "members.manage") !== "none"}>
      <NumberDetail n={n} teams={teams} base={`/preview/${as}`} isOwner={previewScope(as, "numbers.manage") !== "none"} now={now} people={people} />
    </SettingsFrame>
  );
}
