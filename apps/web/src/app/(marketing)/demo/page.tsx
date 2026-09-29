import Link from "next/link";
import { HandoffDemo } from "@/components/marketing/handoff-demo";
import { ManagerHomesPreview } from "@/components/marketing/manager-homes-preview";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "Demo", description: "Try handing a customer chat between team members, and see each manager's home." };

export default function Demo() {
  return (
    <main className="mx-auto grid max-w-6xl gap-14 px-4 py-12">
      <header className="grid gap-3">
        <h1 className="text-4xl font-semibold">Try it with sample data</h1>
        <p className="max-w-2xl text-lg text-muted">This is Qamar Electronics, a sample shop in Dubai. Nothing here is real, and nothing is sent.</p>
      </header>

      <section className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold">Hand a chat to a colleague</h2>
          <ol className="grid list-decimal gap-2 ps-5 text-muted">
            <li>Press <strong className="text-text">Hand over</strong> and choose Sara, the sales manager.</li>
            <li>Try sending without a note. It asks for one, so Sara knows what to do.</li>
            <li>Write why, then hand it over. The note is pinned at the top of the chat.</li>
            <li>Notice that Mariam, the customer, sees one business throughout.</li>
          </ol>
        </div>
        <HandoffDemo full />
      </section>

      <section className="grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid gap-3">
          <h2 className="text-2xl font-semibold">See each manager&apos;s home</h2>
          <p className="text-muted">Switch between Owner, Sales, Support and Operations. Each leads with what needs them now, then the numbers they&apos;re judged on.</p>
        </div>
        <ManagerHomesPreview />
      </section>

      <div className="flex flex-wrap gap-3">
        <Link href="/sign-up" className={buttonClass("primary")}>Start free trial</Link>
        <Link href="/" className={buttonClass("secondary")}>Back to the overview</Link>
      </div>
    </main>
  );
}
