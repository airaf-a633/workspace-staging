import Link from "next/link";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { buttonClass } from "@/components/ui/button";

export const metadata = {
  title: { absolute: "Workspace: run your business from WhatsApp, together" },
  description: "A shared WhatsApp inbox, customer records and a home for every manager, for businesses in the UAE.",
};

const EVERYTHING = [
  ["Customers and deals", "Every chat, email, deal and order on one timeline per customer."],
  ["Tasks and calendar", "Follow-ups with due dates, synced to Google or Outlook calendars."],
  ["Email", "Outlook in the same inbox as WhatsApp. Send from Gmail."],
  ["Your store", "Shopify and WooCommerce orders next to the chat they came from."],
  ["AI help", "Reply suggestions, summaries and translation. A person always sends."],
  ["Campaigns", "Approved templates to the right customers, with opt-outs handled for you."],
  ["Automations", "Route new chats, reply out of hours, create tasks, all without code."],
  ["Reports", "Response times, pipeline and campaign costs, per team."],
];

const PLANS = [
  { name: "Starter", price: "99", seats: "3 people", numbers: "1 WhatsApp number", extra: ["Inbox and customers", "Email and calendar", "500 AI credits a month"] },
  { name: "Growth", price: "249", seats: "8 people", numbers: "2 WhatsApp numbers", extra: ["Everything in Starter", "All manager homes and custom roles", "Automations, campaigns, store", "2,500 AI credits a month"], featured: true },
  { name: "Business", price: "499", seats: "20 people", numbers: "5 WhatsApp numbers", extra: ["Everything in Growth", "Branches and the full API", "7,500 AI credits a month"] },
];

const FAQ = [
  ["Do I pay WhatsApp's message fees to you?", "No. Meta bills those directly to your WhatsApp account. We add nothing on top, and we show you the estimated cost before every campaign."],
  ["Can I keep using the WhatsApp app on my phone?", "Yes. Your number works in the app and in Workspace at the same time. Two things change when you connect: broadcast lists turn off, and WhatsApp groups don't appear in Workspace. You also need to open the app at least every 14 days."],
  ["When can I connect my WhatsApp number?", "You can create your account and set up your team now. Connecting WhatsApp numbers opens as soon as Meta approves our platform. We'll email you the moment it's ready."],
  ["Will my number get banned?", "We only use Meta's official WhatsApp Business Platform, never unofficial tools. Bans usually come from messaging people who didn't agree to it, so Workspace asks for consent before campaigns to imported lists."],
  ["Does it work with Gmail?", "You can send email from Gmail today. Reading Gmail inside Workspace comes after Google's security review. Outlook works fully from the start."],
  ["Where is my data kept?", "In Frankfurt, Germany. Your customers' data belongs to you, and you can export or delete it at any time."],
  ["Can I cancel any time?", "Yes, from Settings, with no call needed. You keep access until the end of the period you paid for."],
];

export default function Landing() {
  return (
    <main>
      {/* 1. Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-[1fr_1.1fr] lg:py-20">
        <div className="grid gap-6">
          <h1 className="text-4xl font-semibold leading-tight text-balance md:text-5xl">Run your business from WhatsApp, together</h1>
          <p className="max-w-xl text-lg text-muted">
            One shared inbox for your team, every customer&apos;s history in one place, and a home for each manager. Keep the WhatsApp app on your phone.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/sign-up" className={buttonClass("primary")}>Start free trial</Link>
            <Link href="/demo" className={buttonClass("secondary")}>Try the demo</Link>
          </div>
          <p className="text-sm text-muted">Free for 14 days. No card needed.</p>
        </div>
        <HandoffDemo />
      </section>

      {/* 2. The problem */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[1fr_2fr]">
          <h2 className="text-2xl font-semibold text-balance">Sound familiar?</h2>
          <ul className="grid gap-5 text-lg">
            <li>Customer chats live on one phone, and the whole team takes turns with it.</li>
            <li>Nobody is sure who replied, who promised what, or who is following up.</li>
            <li>Customer details are split between WhatsApp, email and a spreadsheet.</li>
          </ul>
        </div>
      </section>

      {/* 3. How it works (a real sequence) */}
      <section id="how" className="mx-auto grid max-w-6xl gap-10 px-4 py-16">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <ol className="grid gap-8 md:grid-cols-3">
          {[
            ["Connect your number", "Link your WhatsApp Business number in a few minutes. Your phone keeps working as before."],
            ["Invite your team", "Add sales, support and operations, and choose what each person can see and do."],
            ["Work together", "Claim chats, hand them over with a note, and follow up. Your customer sees one business."],
          ].map(([title, body], i) => (
            <li key={title} className="grid content-start gap-2">
              <span className="num text-sm font-medium text-primary">Step {i + 1}</span>
              <h3 className="text-xl font-semibold">{title}</h3>
              <p className="text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 4. Manager homes */}
      <section className="bg-surface-2">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 lg:grid-cols-2">
          <div className="grid gap-4">
            <h2 className="text-3xl font-semibold text-balance">Each manager gets their own home</h2>
            <p className="text-lg text-muted">
              The owner sees the whole business. Sales sees the pipeline, support sees who&apos;s waiting, operations sees today&apos;s work. Same customers, same data, different focus.
            </p>
            <ul className="grid gap-2">
              {["Chats, deals and tasks each have a clear owner", "Money stays visible only to the roles that need it", "Branches work as teams, each with its own number"].map((t) => (
                <li key={t} className="flex gap-2"><Check size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t}</li>
              ))}
            </ul>
          </div>
          <ManagerHomesPreview />
        </div>
      </section>

      {/* 5. Everything else */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16">
        <h2 className="text-3xl font-semibold">Everything a small team needs, in one place</h2>
        <dl className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
          {EVERYTHING.map(([title, body]) => (
            <div key={title} className="grid gap-1 border-t border-border pt-4">
              <dt className="font-semibold">{title}</dt>
              <dd className="text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 6. Arabic */}
      <section className="border-y border-border bg-surface">
        <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 md:grid-cols-2">
          <div className="grid gap-3">
            <h2 className="text-3xl font-semibold">Arabic, done properly</h2>
            <p className="text-lg text-muted">Every screen works right to left. Each person picks their own language, and customers&apos; messages always show as they wrote them.</p>
          </div>
          <div dir="rtl" lang="ar" className="grid gap-2 rounded-[var(--radius-panel)] border border-border bg-bg p-5">
            <p className="font-semibold">مريم السويدي</p>
            <p className="justify-self-start rounded-[var(--radius-panel)] border border-border bg-surface px-3 py-2">هل يمكنكم خصم 10٪ على 12 جهازًا؟</p>
            <p className="justify-self-end rounded-[var(--radius-panel)] bg-primary-soft px-3 py-2">أهلًا مريم، أفضل ما نقدمه خصم 8٪.</p>
          </div>
        </div>
      </section>

      {/* 7. Pricing (placeholder, labelled) */}
      <section id="pricing" className="mx-auto grid max-w-6xl gap-8 px-4 py-16">
        <div className="grid gap-2">
          <h2 className="text-3xl font-semibold">Simple pricing</h2>
          <p className="text-muted">Per business, not per message. WhatsApp&apos;s own fees are billed by Meta with no markup. <strong className="text-text">Beta pricing, may change.</strong></p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`grid content-start gap-4 rounded-[var(--radius-panel)] border bg-surface p-6 ${p.featured ? "border-primary" : "border-border"}`}>
              <div className="grid gap-1">
                <h3 className="text-xl font-semibold">{p.name}</h3>
                <p><span className="num text-3xl font-medium">AED {p.price}</span> <span className="text-muted">/ month</span></p>
                <p className="text-sm text-muted">{p.seats} · {p.numbers}</p>
              </div>
              <ul className="grid gap-2">
                {p.extra.map((e) => <li key={e} className="flex gap-2"><Check size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{e}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-muted">Deliver your own orders? Add <strong className="text-text">Orders &amp; Delivery</strong> for AED 99 a month: dispatch, a rider page and end-of-day cash. Riders are free.</p>
      </section>

      {/* 8. Questions */}
      <section id="questions" className="bg-surface-2">
        <div className="mx-auto grid max-w-3xl gap-6 px-4 py-16">
          <h2 className="text-3xl font-semibold">Questions</h2>
          <div className="grid gap-2">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group rounded-[var(--radius-control)] border border-border bg-surface">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 font-medium [&::-webkit-details-marker]:hidden">
                  {q}<span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-4 pb-4 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 9. Final call to action */}
      <section className="mx-auto grid max-w-3xl justify-items-center gap-5 px-4 py-20 text-center">
        <h2 className="text-3xl font-semibold text-balance">Bring your team onto one WhatsApp number</h2>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/sign-up" className={buttonClass("primary")}>Start free trial</Link>
          <Link href="/demo" className={buttonClass("secondary")}>Try the demo</Link>
        </div>
      </section>
    </main>
  );
}
