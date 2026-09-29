import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { TextInput } from "@/components/ui/field";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Create your account" };

/* The real sign-up screen, without the form action: "Create account" moves on to onboarding. */
export default function PreviewSignUp() {
  return (
    <AuthFrame
      title="Create your account"
      description="Your 14-day trial starts when you connect WhatsApp. No card needed."
      footer={<Link className="font-medium text-primary underline-offset-4 hover:underline" href="/preview">Back to the preview</Link>}
    >
      {/* Not a form: whatever is typed here never leaves the page (and never lands in a URL). */}
      <div className="grid gap-4">
        <TextInput label="Your name" name="name" autoComplete="off" defaultValue="Khalid" />
        <TextInput label="Work email" name="email" type="email" autoComplete="off" defaultValue="khalid@qamar.test" />
        <TextInput label="Password" name="password" type="password" autoComplete="off" help="At least 10 characters. Not used in the preview." />
        <Link href="/preview/onboarding" className={buttonClass("primary", "md", "w-full")}>Create account</Link>
      </div>
      <p className="text-sm text-muted">
        By creating an account you agree to the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy policy</Link>.
      </p>
    </AuthFrame>
  );
}
