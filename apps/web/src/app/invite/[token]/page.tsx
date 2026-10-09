import { AuthFrame } from "@/components/auth-frame";
import { ButtonLink } from "@/components/ui/button";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getT } from "@/i18n/server";
import { getUser } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

export async function generateMetadata() {
  return { title: (await getT("invite"))("joinTitle") };
}

const ERRORS = ["needName", "wrongEmail", "alreadyMember", "invalid"] as const;

export default async function Invite(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const user = await getUser();
  const here = `/invite/${token}`;
  const t = await getT("invite");

  if (!user) {
    return (
      <AuthFrame title={t("invitedTitle")} description={t("invitedBody")}>
        <div className="grid gap-3">
          <ButtonLink variant="primary" href={`/sign-up?next=${encodeURIComponent(here)}`}>{t("createAccount")}</ButtonLink>
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`}>{t("haveAccount")}</ButtonLink>
        </div>
      </AuthFrame>
    );
  }

  const code = ERRORS.find((e) => e === sp.error);
  return (
    <AuthFrame title={t("joinTitle")} description={t.rich("signedInAs", { email: <strong dir="ltr">{user.email}</strong> })}>
      {code && <Notice tone="error" title={t(`errors.${code}`, { email: user.email ?? "" })} />}
      <form action={acceptInvite} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <TextInput label={t("nameLabel")} name="name" defaultValue={(user.user_metadata?.name as string) ?? ""} autoComplete="name" required />
        <Submit pending={t("pending")}>{t("submit")}</Submit>
      </form>
    </AuthFrame>
  );
}
