import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { previewMode, safeNextPath } from "@/lib/preview-gate";
import { unlock } from "./actions";

export const metadata = { title: "Private preview", robots: { index: false, follow: false } };

/* The one door into the hosted partner preview (SITE_MODE=preview). Elsewhere this page doesn't exist. */
export default async function Unlock(props: PageProps<"/unlock">) {
  if (!previewMode()) notFound();
  const sp = await props.searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  return (
    <AuthFrame title="Private preview" description="This is an early look at Workspace with sample data. Enter the password you were given.">
      {sp.error && <Notice tone="error" title="That password didn't work. Check it and try again." />}
      <form action={unlock} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label="Password" name="password" type="password" autoComplete="current-password" required autoFocus />
        <Submit pending="Opening…">Open the preview</Submit>
      </form>
    </AuthFrame>
  );
}
