import { redirect } from "next/navigation";

/* WhatsApp numbers became one kind of channel (2026-10-07). */
export default async function PreviewWhatsAppNumber(props: PageProps<"/preview/[as]/whatsapp/[id]">) {
  const { as } = await props.params;
  redirect(`/preview/${as}/channels/in-wa`);
}
