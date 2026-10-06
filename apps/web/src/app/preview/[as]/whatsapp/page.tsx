import { redirect } from "next/navigation";

/* WhatsApp numbers became one kind of channel (2026-10-07). */
export default async function PreviewWhatsApp(props: PageProps<"/preview/[as]/whatsapp">) {
  const { as } = await props.params;
  redirect(`/preview/${as}/channels`);
}
