import { notFound } from "next/navigation";
import { AuthFrame } from "@/components/auth-frame";
import { LanguageSwitch } from "@/components/language-switch";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { previewMode, safeNextPath } from "@/lib/preview-gate";
import { unlock } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("unlock"))("title"), robots: { index: false, follow: false } };
}

/* The one door into the hosted partner preview (SITE_MODE=preview). Elsewhere this page doesn't exist. */
export default async function Unlock(props: PageProps<"/unlock">) {
  if (!previewMode()) notFound();
  const sp = await props.searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : undefined);
  const t = await getT("unlock");
  const auth = await getT("auth");
  return (
    <AuthFrame title={t("title")} description={t("description")} footer={<LanguageSwitch />}>
      {sp.error && <Notice tone="error" title={t("wrong")} />}
      <form action={unlock} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label={auth("password")} name="password" type="password" autoComplete="current-password" dir="ltr" required autoFocus />
        <Submit pending={t("pending")}>{t("submit")}</Submit>
      </form>
    </AuthFrame>
  );
}
