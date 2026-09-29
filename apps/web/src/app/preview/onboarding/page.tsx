import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { PreviewOnboarding } from "@/components/preview/onboarding";

export const metadata = { title: "Set up your business" };

export default function PreviewOnboardingPage() {
  return (
    <AuthFrame
      title="Set up your business"
      description="Start with your business name. You can change it later."
      footer={<Link className="font-medium text-primary underline-offset-4 hover:underline" href="/preview">Back to the preview</Link>}
    >
      <PreviewOnboarding />
    </AuthFrame>
  );
}
