import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { Submit } from "@/components/ui/submit";
import { TextInput } from "@/components/ui/field";
import { Notice } from "@/components/ui/surface";
import { safeNext } from "@/lib/safe-next";
import { signUp } from "../actions";

export const metadata = { title: "Create your account" };

export default async function SignUp(props: PageProps<"/sign-up">) {
  const sp = await props.searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : undefined);
  const error = typeof sp.error === "string" ? sp.error : undefined;

  if (sp.confirm) {
    return (
      <AuthFrame title="Check your email" description="We sent you a link to confirm your email. Open it on this device to continue.">
        <Notice tone="info" title="Didn't get it?">Check your spam folder, or wait a minute and try signing up again.</Notice>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      title="Create your account"
      description="Free for 14 days. No card needed."
      footer={<>Already have an account? <Link className="font-medium text-primary underline-offset-4 hover:underline" href={`/sign-in?next=${encodeURIComponent(next)}`}>Sign in</Link></>}
    >
      {error && <Notice tone="error" title={error} />}
      <form action={signUp} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <TextInput label="Your name" name="name" autoComplete="name" required />
        <TextInput label="Work email" name="email" type="email" autoComplete="email" required />
        <TextInput label="Password" name="password" type="password" autoComplete="new-password" minLength={10} help="At least 10 characters." required />
        <Submit pending="Creating account…">Create account</Submit>
      </form>
      <p className="text-sm text-muted">
        By creating an account you agree to the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy policy</Link>.
      </p>
    </AuthFrame>
  );
}
