import { StaffConsole } from "@/components/admin/staff-console";
import { getT } from "@/i18n/server";
import { previewNow } from "@/lib/preview";

export async function generateMetadata() {
  return { title: (await getT("staff"))("title") };
}

/* Relay's own staff console, as a preview. In production it lives on a separate staff sign-in, never inside a workspace. */
export default function PreviewStaff() {
  return <StaffConsole now={previewNow()} />;
}
