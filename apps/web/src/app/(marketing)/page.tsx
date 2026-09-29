import Link from "next/link";
import { ArrowRight, ArrowsLeftRight, Check, UsersThree, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { PhotoSlot } from "@/components/marketing/photo-slot";
import { buttonClass } from "@/components/ui/button";

export const metadata = {
  title: { absolute: "Workspace: run your business from WhatsApp, together" },
  description: "A shared WhatsApp inbox, customer records and a home for every manager, for businesses in the UAE.",
};

const FACTS = [
  ["0%", "markup on WhatsApp's fees. Meta bills you directly."],
  ["1", "WhatsApp number for your whole team. The phone app keeps working."],
  ["2", "languages from day one: English and Arabic, right to left."],
  ["14", "days free, counted from the day you connect WhatsApp."],
];

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
  ["When can I connect my WhatsApp number?", "You can create your account and set up your team now. Connecting WhatsApp numbers opens as soon as Meta approves our platform. We'll email you the moment it's ready. Your 14-day trial only starts when you connect, so you lose nothing by signing up early."],
  ["Will my number get banned?", "We only use Meta's official WhatsApp Business Platform, never unofficial tools. Bans usually come from messaging people who didn't agree to it, so Workspace asks for consent before campaigns to imported lists."],
  ["Does it work with Gmail?", "You can send email from Gmail today. Reading Gmail inside Workspace comes after Google's security review. Outlook works fully from the start."],
  ["Where is my data kept?", "In Frankfurt, Germany. Your customers' data belongs to you, and you can export or delete it at any time."],
  ["Can I cancel any time?", "Yes, from Settings, with no call needed. You keep access until the end of the period you paid for."],
];

const STEPS = [
  { Icon: WhatsappLogo, title: "Connect your number", body: "Link your WhatsApp Business number in a few minutes. Your phone keeps working as before." },
  { Icon: UsersThree, title: "Invite your team", body: "Add sales, support and operations, and choose what each person can see and do." },
  { Icon: ArrowsLeftRight, title: "Work together", body: "Claim chats, hand them over with a note, and follow up. Your customer sees one business." },
];

export default function Landing() {
  return (
    <main className="overflow-x-clip">
      {/* 1. Hero: atmosphere, a photo of the people, and the real product on top of it. */}
      <section className="bg-hero drift -mt-24 rounded-b-[2.5rem] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-36 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-44">
          <div className="grid gap-7">
            <h1 className="display text-5xl sm:text-6xl lg:text-7xl">Run your business from WhatsApp, together</h1>
            <p className="display text-2xl text-white/90 sm:text-3xl">Inbox + customers + handoffs.</p>
            <p className="max-w-lg text-lg text-white/85">
              One shared inbox for your team, every customer&apos;s history in one place, and a home for each manager. Keep the WhatsApp app on your phone.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/sign-up" className={buttonClass("light", "lg")}>Start free trial</Link>
              <Link href="/demo" className={buttonClass("glass", "lg")}>Try the demo</Link>
            </div>
            <p className="text-sm text-white/75">14 days free from the day you connect WhatsApp. No card needed.</p>
          </div>

          <div className="relative lg:ps-6">
            <PhotoSlot
              alt="A shop owner in Dubai answering customers on her phone"
              brief="a shop owner in Dubai replying to customers on her phone, natural light"
              className="aspect-[4/5] rounded-[2rem] sm:aspect-[5/4] lg:aspect-[4/5]"
            />
            <div className="relative -mt-40 ms-auto w-[92%] text-text shadow-[var(--shadow-float)] sm:-mt-56 lg:absolute lg:-bottom-10 lg:-start-10 lg:mt-0 lg:w-[85%]">
              <HandoffDemo />
            </div>
          </div>
        </div>
      </section>

      {/* 2. Facts we can stand behind (no invented customer numbers before launch). */}
      <section className="mx-auto max-w-6xl px-4 py-20 lg:pt-28">
        <dl className="reveal grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(([n, t]) => (
            <div key={t} className="grid content-start gap-2 border-t border-border pt-5">
              <dt className="display text-6xl text-primary">{n}</dt>
              <dd className="text-muted">{t}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 3. The problem, as a statement */}
      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 md:grid-cols-[1fr_1.4fr]">
        <h2 className="display reveal text-4xl sm:text-5xl">Sound familiar?</h2>
        <ul className="reveal grid gap-6 text-xl sm:text-2xl">
          <li className="border-b border-border pb-6">Customer chats live on one phone, and the whole team takes turns with it.</li>
          <li className="border-b border-border pb-6">Nobody is sure who replied, who promised what, or who is following up.</li>
          <li>Customer details are split between WhatsApp, email and a spreadsheet.</li>
        </ul>
      </section>

      {/* 4. How it works, on the soft petrol-mint wash */}
      <section id="how" className="bg-soft scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-24">
          <div className="reveal grid max-w-2xl gap-3">
            <h2 className="display text-4xl sm:text-5xl">How it works</h2>
            <p className="text-lg text-muted">Three steps, and your team is working from one number.</p>
          </div>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className="glass-light reveal grid content-start gap-4 rounded-[var(--radius-panel)] p-7 shadow-[var(--shadow-1)]" style={{ transitionDelay: `${i * 90}ms` }}>
                <div className="flex items-center justify-between">
                  <span className="grid size-12 place-items-center rounded-full bg-button text-on-primary"><Icon size={24} aria-hidden="true" /></span>
                  <span className="display text-5xl text-primary/40">0{i + 1}</span>
                </div>
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="text-muted">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 5. Manager homes */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-24 lg:grid-cols-2">
        <div className="reveal grid gap-5">
          <h2 className="display text-4xl sm:text-5xl">Each manager gets their own home</h2>
          <p className="text-lg text-muted">
            The owner sees the whole business. Sales sees the pipeline, support sees who&apos;s waiting, operations sees today&apos;s work. Same customers, same data, different focus.
          </p>
          <ul className="grid gap-3">
            {["Chats, deals and tasks each have a clear owner", "Money stays visible only to the roles that need it", "Branches work as teams, each with its own number"].map((t) => (
              <li key={t} className="flex gap-3"><Check size={22} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />{t}</li>
            ))}
          </ul>
          <Link href="/preview" className="inline-flex items-center gap-2 font-medium text-primary hover:underline">
            Walk through the app <ArrowRight size={18} className="rtl:rotate-180" aria-hidden="true" />
          </Link>
        </div>
        <div className="reveal relative">
          <div className="absolute -inset-3 -z-10 rounded-[2.5rem] bg-soft sm:-inset-6" aria-hidden="true" />
          <div className="shadow-[var(--shadow-float)]"><ManagerHomesPreview /></div>
        </div>
      </section>

      {/* 6. Everything else */}
      <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-24">
        <h2 className="display reveal max-w-3xl text-4xl sm:text-5xl">Everything a small team needs, in one place</h2>
        <dl className="reveal grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {EVERYTHING.map(([title, body]) => (
            <div key={title} className="grid content-start gap-2 border-t border-border pt-5">
              <dt className="font-semibold">{title}</dt>
              <dd className="text-muted">{body}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 7. Arabic */}
      <section className="px-3">
        <div className="bg-hero drift mx-auto grid max-w-6xl items-center gap-10 rounded-[2.5rem] px-6 py-16 text-white md:grid-cols-2 md:px-12">
          <div className="reveal grid gap-4">
            <h2 className="display text-4xl sm:text-5xl">Arabic, done properly</h2>
            <p className="text-lg text-white/85">Every screen works right to left. Each person picks their own language, and customers&apos; messages always show as they wrote them.</p>
          </div>
          <div dir="rtl" lang="ar" className="reveal grid gap-3 rounded-[var(--radius-panel)] bg-surface p-6 text-text shadow-[var(--shadow-float)]">
            <p className="font-semibold">مريم السويدي</p>
            <p className="justify-self-start rounded-[var(--radius-panel)] border border-border bg-surface px-4 py-2">هل يمكنكم خصم 10٪ على 12 جهازًا؟</p>
            <p className="justify-self-end rounded-[var(--radius-panel)] bg-primary-soft px-4 py-2">أهلًا مريم، أفضل ما نقدمه خصم 8٪.</p>
          </div>
        </div>
      </section>

      {/* 8. Pricing (placeholder, labelled) */}
      <section id="pricing" className="mx-auto grid max-w-6xl scroll-mt-24 gap-10 px-4 py-24">
        <div className="reveal grid max-w-2xl gap-3">
          <h2 className="display text-4xl sm:text-5xl">Simple pricing</h2>
          <p className="text-lg text-muted">Per business, not per message. WhatsApp&apos;s own fees are billed by Meta with no markup. <strong className="font-medium text-text">Beta pricing, may change.</strong></p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div
              key={p.name}
              style={{ transitionDelay: `${i * 90}ms` }}
              className={`reveal grid content-start gap-6 rounded-[var(--radius-panel)] p-7 ${p.featured ? "bg-hero text-white shadow-[var(--shadow-float)]" : "border border-border bg-surface"}`}
            >
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xl font-semibold">{p.name}</h3>
                  {p.featured && <span className="glass rounded-full px-3 py-0.5 text-sm">Most teams</span>}
                </div>
                <p className="flex items-baseline gap-2">
                  <span className="display text-5xl">AED {p.price}</span>
                  <span className={p.featured ? "text-white/75" : "text-muted"}>/ month</span>
                </p>
                <p className={`text-sm ${p.featured ? "text-white/80" : "text-muted"}`}>{p.seats} · {p.numbers}</p>
              </div>
              <ul className="grid gap-2.5">
                {p.extra.map((e) => (
                  <li key={e} className="flex gap-2"><Check size={20} className={`mt-0.5 shrink-0 ${p.featured ? "text-[#8FD9D0]" : "text-primary"}`} aria-hidden="true" />{e}</li>
                ))}
              </ul>
              <Link href="/sign-up" className={buttonClass(p.featured ? "light" : "secondary", "md", "mt-auto")}>Start free trial</Link>
            </div>
          ))}
        </div>
        <p className="reveal text-muted">Deliver your own orders? Add <strong className="font-medium text-text">Orders &amp; Delivery</strong> for AED 99 a month: dispatch, a rider page and end-of-day cash. Riders are free.</p>
      </section>

      {/* 9. Questions */}
      <section id="questions" className="bg-soft scroll-mt-24">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 md:grid-cols-[1fr_1.6fr]">
          <h2 className="display reveal text-4xl sm:text-5xl">Questions</h2>
          <div className="reveal grid gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="glass-light group rounded-[var(--radius-panel)]">
                <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-soft text-lg text-primary transition-transform duration-300 group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-5 text-muted">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Final call to action */}
      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-28">
        <h2 className="display reveal max-w-4xl text-5xl sm:text-7xl lg:text-8xl">Bring your team onto one WhatsApp number.</h2>
        <div className="reveal flex flex-wrap gap-3">
          <Link href="/sign-up" className={buttonClass("primary", "lg")}>Start free trial</Link>
          <Link href="/demo" className={buttonClass("secondary", "lg")}>Try the demo</Link>
        </div>
      </section>
    </main>
  );
}
