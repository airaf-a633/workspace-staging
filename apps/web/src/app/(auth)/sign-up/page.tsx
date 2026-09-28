import Link from "next/link";
import { Field, Notice, Page, Submit } from "@/components/plain";
import { safeNext } from "@/lib/safe-next";
import { signUp } from "../actions";

export default async function SignUp(props: PageProps<"/sign-up">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  if (sp.confirm) {
    return (
      <Page title="Check your email">
        <Notice tone="info">We sent you a link to confirm your email. Open it on this device to continue.</Notice>
      </Page>
    );
  }

  return (
    <Page title="Create your account">
      {error && <Notice tone="error">{error}</Notice>}
      <form action={signUp} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Your name" name="name" autoComplete="name" required />
        <Field label="Work email" name="email" type="email" autoComplete="email" required />
        <Field label="Password (at least 10 characters)" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <Submit>Create account</Submit>
      </form>
      <p className="text-sm">
        Already have an account? <Link className="underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </Page>
  );
}
