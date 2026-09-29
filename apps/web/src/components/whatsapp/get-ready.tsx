import Link from "next/link";
import { Clock } from "@phosphor-icons/react/dist/ssr";
import { ListSurface } from "@/components/settings-frame";

/**
 * The WhatsApp numbers page before Meta approves our platform (decided 2026-09-30): say honestly that
 * connecting isn't open yet, and list what the owner can prepare now.
 */
export function GetReady({ teamsHref }: { teamsHref: string }) {
  const steps = [
    {
      title: "Verify your business with Meta",
      body: "In Meta Business Suite, open Settings, then Security Centre, and start business verification. You'll need your trade licence and a website or email on your business domain. Unverified businesses can only start conversations with 250 new customers a day.",
    },
    {
      title: "Choose the number",
      body: "Use the number already on the WhatsApp Business app. It keeps working on the phone, and you open the app at least every 14 days. A number on personal WhatsApp has to move to the WhatsApp Business app first; its chats come with it.",
    },
    {
      title: "Add a card to Meta for message fees",
      body: "Meta charges message fees directly to your card in Meta Business Suite. We add nothing on top, and you'll see the cost before every campaign.",
    },
    {
      title: "Decide who gets which chats",
      body: "Put people in teams, such as a branch or sales and support. Each number can belong to a team, and new chats go to that team's queue.",
      href: teamsHref,
      cta: "Set up teams",
    },
  ];

  return (
    <div className="grid gap-5">
      <div className="flex gap-3 rounded-[var(--radius-panel)] bg-primary-soft p-4">
        <Clock size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div className="grid gap-1">
          <p className="font-semibold">Connecting opens as soon as Meta approves our platform</p>
          <p className="text-sm text-muted">We&apos;ll email you the moment it&apos;s ready. Your 14-day trial starts when your first number connects, so nothing is lost by waiting. Meanwhile, these four things make connecting take minutes.</p>
        </div>
      </div>
      <ListSurface>
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-4 border-b border-border px-5 py-4 last:border-0">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold tabular-nums text-muted">{i + 1}</span>
            <span className="grid gap-1">
              <span className="font-medium">{s.title}</span>
              <span className="text-sm text-muted">{s.body}</span>
              {s.href && <Link href={s.href} className="w-fit text-sm font-medium text-primary hover:underline">{s.cta}</Link>}
            </span>
          </li>
        ))}
      </ListSurface>
    </div>
  );
}
