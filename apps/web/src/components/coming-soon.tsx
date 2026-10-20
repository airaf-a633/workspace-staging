import type { ReactNode } from "react";
import { EmptyState, PageHeader } from "@/components/ui/surface";

/** Placeholder for sections that exist in the navigation before their milestone ships. */
export function ComingSoon({ title, icon, heading, children }: { title: string; icon: ReactNode; heading: string; children: ReactNode }) {
  return (
    <>
      <PageHeader title={title} />
      <EmptyState icon={icon} title={heading}>{children}</EmptyState>
    </>
  );
}
