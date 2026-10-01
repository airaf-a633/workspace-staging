import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { safeNext } from "@/lib/safe-next";
import { sendMagicLink, signInWithPassword } from "../actions";

export async function generateMetadata() {
  return { title: (await getT("auth"))("signIn.title") };
}

export default async function SignIn(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const t = await getT("auth");
  const error = typeof sp.error === "string" ? (t.has(`errors.${sp.error}`) ? t(`errors.${sp.error}` as "errors.generic") : t("errors.generic")) : undefined;

  return (
    <AuthFrame
      title={t("signIn.title")}
      footer={<>{t("signIn.newHere")} <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>{t("signIn.createAccount")}</Link></>}
    >
      {error && <Notice tone="error" title={error} />}
      {sp.sent && <Notice tone="success" title={t("signIn.sentTitle")}>{t("signIn.sentBody")}</Notice>}

      <form action={signInWithPassword} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label={t("email")} name="email" type="email" autoComplete="email" dir="ltr" required />
        <TextInput label={t("password")} name="password" type="password" autoComplete="current-password" dir="ltr" required />
        <Submit pending={t("signIn.pending")}>{t("signIn.submit")}</Submit>
      </form>

      <details className="border-t border-border pt-4">
        <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">{t("signIn.forgot")}</summary>
        <form action={sendMagicLink} className="mt-3 grid gap-3">
          <input type="hidden" name="next" value={next} />
          <TextInput label={t("email")} name="email" type="email" autoComplete="email" dir="ltr" required />
          <Submit variant="secondary" pending={t("signIn.sending")}>{t("signIn.sendLink")}</Submit>
        </form>
      </details>
    </AuthFrame>
  );
}
