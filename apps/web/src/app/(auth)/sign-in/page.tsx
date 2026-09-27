import Link from "next/link";
import { Field, Notice, Page, Submit } from "@/components/plain";
import { safeNext } from "@/lib/safe-next";
import { sendMagicLink, signInWithPassword } from "../actions";

export default async function SignIn(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <Page title="Sign in">
      {error && <Notice tone="error">{error}</Notice>}
      {sp.sent && <Notice tone="info">If that email has an account, a sign-in link is on its way. It works once and expires in 1 hour.</Notice>}

      <form action={signInWithPassword} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Submit>Sign in</Submit>
      </form>

      <form action={sendMagicLink} className="grid gap-4 border-t pt-6">
        <input type="hidden" name="next" value={next} />
        <Field label="Or get a sign-in link by email" name="email" type="email" autoComplete="email" required />
        <Submit variant="secondary">Email me a link</Submit>
      </form>

      <p className="text-sm">
        New here? <Link className="underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </Page>
  );
}
