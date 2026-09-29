import { AuthFrame } from "@/components/auth-frame";
import { ButtonLink } from "@/components/ui/button";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { getUser } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

export const metadata = { title: "Join the workspace" };

export default async function Invite(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const user = await getUser();
  const here = `/invite/${token}`;

  if (!user) {
    return (
      <AuthFrame title="You've been invited" description="Create an account or sign in with the email address the invite was sent to.">
        <div className="grid gap-3">
          <ButtonLink variant="primary" href={`/sign-up?next=${encodeURIComponent(here)}`}>Create an account</ButtonLink>
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(here)}`}>I already have an account</ButtonLink>
        </div>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame title="Join the workspace" description={<>Signed in as <strong>{user.email}</strong>.</>}>
      {typeof sp.error === "string" && <Notice tone="error" title={sp.error} />}
      <form action={acceptInvite} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <TextInput label="Your name, as your team will see it" name="name" defaultValue={(user.user_metadata?.name as string) ?? ""} autoComplete="name" required />
        <Submit pending="Joining…">Join</Submit>
      </form>
    </AuthFrame>
  );
}
