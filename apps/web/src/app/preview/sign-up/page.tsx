import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("auth"))("signUp.title") };
}

/* The real sign-up screen, without the form action: "Create account" moves on to onboarding. */
export default async function PreviewSignUp() {
  const t = await getT("auth");
  const preview = await getT("preview");
  return (
    <AuthFrame
      title={t("signUp.title")}
      description={t("signUp.description")}
      footer={<Link className="font-medium text-primary underline-offset-4 hover:underline" href="/preview">{preview("backToPreview")}</Link>}
    >
      {/* Not a form: whatever is typed here never leaves the page (and never lands in a URL). */}
      <div className="grid gap-4">
        <TextInput label={t("yourName")} name="name" autoComplete="off" defaultValue="Khalid" />
        <TextInput label={t("workEmail")} name="email" type="email" autoComplete="off" dir="ltr" defaultValue="elena@northwind.test" />
        <TextInput label={t("password")} name="password" type="password" autoComplete="off" dir="ltr" help={preview("passwordHelp")} />
        <Link href="/preview/onboarding" className={buttonClass("primary", "md", "w-full")}>{t("signUp.submit")}</Link>
      </div>
      <p className="text-sm text-muted">
        {t.rich("signUp.agree", {
          terms: <Link className="underline" href="/terms">{t("signUp.terms")}</Link>,
          privacy: <Link className="underline" href="/privacy">{t("signUp.privacy")}</Link>,
        })}
      </p>
    </AuthFrame>
  );
}
