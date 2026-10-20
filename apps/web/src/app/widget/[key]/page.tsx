import { notFound } from "next/navigation";
import { WidgetChat } from "@/components/widget/widget-chat";
import { createAdminClient } from "@/lib/supabase/admin";
import { KEY, toConfig } from "@/lib/widget/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat", robots: { index: false, follow: false } };

/* The chat panel inside the website widget's frame. Public: it knows only the widget key. */
export default async function WidgetPage(props: PageProps<"/widget/[key]">) {
  const { key } = await props.params;
  if (!KEY.test(key)) notFound();
  const { data } = await createAdminClient().rpc("webchat_config", { p_key: key });
  const row = (data as Parameters<typeof toConfig>[0][] | null)?.[0];
  if (!row) notFound();
  return <WidgetChat widgetKey={key} config={toConfig(row)} />;
}
