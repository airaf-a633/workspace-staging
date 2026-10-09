import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { safeNext } from "@/lib/safe-next";
import { signUp } from "../actions";

export async function generateMetadata() {
  return { title: (await getT("auth"))("signUp.title") };
}

export default async function SignUp(props: PageProps<"/sign-up">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const t = await getT("auth");
  const error = typeof sp.error === "string" ? (t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}` as "errors.generic") : t("errors.generic")) : undefined;

  if (sp.confirm) {
    return (
      <AuthFrame title={t("confirm.title")} description={t("confirm.body")}>
        <Notice tone="info" title={t("confirm.notGot")}>{t("confirm.notGotBody")}</Notice>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title={t("signUp.title")}
      description={t("signUp.description")}
      footer={<>{t("signUp.haveAccount")} <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>{t("signIn.title")}</Link></>}
    >
      {error && <Notice tone="error" title={error} />}
      <form action={signUp} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label={t("yourName")} name="name" autoComplete="name" required />
        <TextInput label={t("workEmail")} name="email" type="email" autoComplete="email" dir="ltr" required />
        <TextInput label={t("password")} name="password" type="password" autoComplete="new-password" dir="ltr" minLength={10} help={t("passwordHelp")} required />
        <Submit pending={t("signUp.pending")}>{t("signUp.submit")}</Submit>
      </form>
      <p className="text-sm text-muted">
        {t.rich("signUp.agree", {
          terms: <Link className="underline" href="/terms">{t("signUp.terms")}</Link>,
          privacy: <Link className="underline" href="/privacy">{t("signUp.privacy")}</Link>,
        })}
      </p>
    </AuthFrame>
  );
}
