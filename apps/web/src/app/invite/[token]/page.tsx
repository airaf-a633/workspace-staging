import Link from "next/link";
import { Field, Notice, Page, Submit } from "@/components/plain";
import { getUser } from "@/lib/supabase/server";
import { acceptInvite } from "./actions";

export default async function Invite(props: PageProps<"/invite/[token]">) {
  const { token } = await props.params;
  const sp = await props.searchParams;
  const user = await getUser();
  const here = `/invite/${token}`;

  if (!user) {
    return (
      <Page title="You've been invited">
        <p>Create an account or sign in with the email address the invite was sent to.</p>
        <div className="flex gap-4">
          <Link className="underline" href={`/sign-up?next=${encodeURIComponent(here)}`}>Create an account</Link>
          <Link className="underline" href={`/sign-in?next=${encodeURIComponent(here)}`}>Sign in</Link>
        </div>
      </Page>
    );
  }

  return (
    <Page title="Join the workspace">
      {typeof sp.error === "string" && <Notice tone="error">{sp.error}</Notice>}
      <p>You&apos;re signed in as {user.email}.</p>
      <form action={acceptInvite} className="grid gap-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Your name, as your team will see it" name="name" defaultValue={(user.user_metadata?.name as string) ?? ""} required />
        <Submit>Join</Submit>
      </form>
    </Page>
  );
}
