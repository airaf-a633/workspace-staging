import type { Metadata } from "next";

// The design preview is public but shouldn't appear in search results.
export const metadata: Metadata = {
  title: { default: "Preview", template: "%s · Preview · Workspace" },
  robots: { index: false, follow: false },
};

export default function PreviewRoot({ children }: LayoutProps<"/preview">) {
  return children;
}
