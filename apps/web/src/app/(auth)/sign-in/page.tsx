import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/button";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { safeNext } from "@/lib/safe-next";
import { sendMagicLink, signInWithPassword } from "../actions";

export const metadata = { title: "Sign in" };

export default async function SignIn(props: PageProps<"/sign-in">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  return (
    <AuthFrame
      title="Sign in"
      footer={<>New here? <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/sign-up?next=${encodeURIComponent(next)}`}>Create an account</Link></>}
    >
      {error && <Notice tone="error" title={error} />}
      {sp.sent && <Notice tone="success" title="Check your email">If that email has an account, a sign-in link is on its way. It works once and expires in 1 hour.</Notice>}

      <form action={signInWithPassword} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label="Email" name="email" type="email" autoComplete="email" required />
        <TextInput label="Password" name="password" type="password" autoComplete="current-password" required />
        <Submit pending="Signing in…">Sign in</Submit>
      </form>

      <details className="border-t border-border pt-4">
        <summary className="min-h-11 cursor-pointer list-none text-sm font-medium text-primary [&::-webkit-details-marker]:hidden">Forgot your password? Get a sign-in link instead</summary>
        <form action={sendMagicLink} className="mt-3 grid gap-3">
          <input type="hidden" name="next" value={next} />
          <TextInput label="Email" name="email" type="email" autoComplete="email" required />
          <Submit variant="secondary" pending="Sending…">Email me a link</Submit>
        </form>
      </details>
    </AuthFrame>
  );
}
