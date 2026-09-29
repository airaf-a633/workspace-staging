/** The five-step setup checklist (PRODUCT_DECISIONS §14), shared by Home, Settings › Account and the preview. */

export type TeamShape = "solo" | "small" | "split" | "delivery" | null;

export interface SetupStep {
  title: string;
  body: string;
  done: boolean;
  href: string | null;
  soon: string | null;
}

export function setupSteps({ shape, memberCount, connected, base }: { shape: TeamShape; memberCount: number; connected: boolean; base: string }): SetupStep[] {
  return [
    {
      title: "Connect WhatsApp",
      body: "Link your business number and keep using the WhatsApp app on your phone.",
      done: connected,
      href: `${base}/whatsapp`,
      soon: connected ? null : "Opens as soon as Meta approves our platform. We'll email you. Your trial starts then.",
    },
    {
      title: shape === "solo" ? "Invite your team (optional)" : "Invite your team",
      body:
        shape === "solo" ? "Skip this if it's just you. You can add people any time."
        : shape === "split" ? "Add your sales and support managers, then put each in their own team."
        : "Add managers and agents, and choose what each can see.",
      done: memberCount > 1,
      href: `${base}/members?invite=1`,
      soon: null,
    },
    { title: "Set working hours", body: "So customers get an out-of-hours reply and reply targets are fair.", done: false, href: null, soon: "Coming soon" },
    { title: "Import your customers", body: "Upload a spreadsheet or bring contacts from your phone.", done: false, href: null, soon: "Coming soon" },
    { title: "Connect your store and email", body: "Shopify or WooCommerce orders and Outlook or Gmail, next to every chat.", done: false, href: null, soon: "Coming soon" },
  ];
}
