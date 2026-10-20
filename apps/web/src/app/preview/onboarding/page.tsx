import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { PreviewOnboarding } from "@/components/preview/onboarding";
import { getT } from "@/i18n/server";

export async function generateMetadata() {
  return { title: (await getT("onboarding"))("title") };
}

export default async function PreviewOnboardingPage() {
  const t = await getT("onboarding");
  const preview = await getT("preview");
  return (
    <AuthFrame
      title={t("title")}
      description={t("description")}
      footer={<Link className="font-medium text-primary underline-offset-4 hover:underline" href="/preview">{preview("backToPreview")}</Link>}
    >
      <PreviewOnboarding />
    </AuthFrame>
  );
}
