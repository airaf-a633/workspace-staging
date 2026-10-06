import type { Metadata } from "next";
import { EnglishOnlyNotice } from "@/components/marketing/english-only";
import Link from "next/link";

/*
 * DRAFT data processing agreement, written 2026-09-28. Must be reviewed by a UAE lawyer before launch
 * (and by EU counsel if we sign EU customers, to attach the right Standard Contractual Clauses module).
 * Everything in [SQUARE BRACKETS] is a placeholder the founder must fill in.
 * The subprocessor list must match the one in the privacy policy.
 */

export const metadata: Metadata = {
  title: "Data processing agreement",
  description: "How Relay processes personal data on behalf of its customers.",
};

const UPDATED = "28 September 2026";

const SUBPROCESSORS = [
  ["Supabase Inc.", "Database, sign-in and file storage", "Germany (Frankfurt, EU)"],
  ["Vercel Inc.", "Web application hosting", "Germany (Frankfurt, EU)"],
  ["Fly.io Inc.", "Background processing", "Germany (Frankfurt, EU)"],
  ["Anthropic PBC", "AI features, only when a user requests them or turns on automatic replies", "United States"],
  ["Nango Inc.", "Secure connections to email, calendar and store accounts", "EU and United States"],
  ["Sentry (Functional Software Inc.)", "Error monitoring (no message content by design)", "EU and United States"],
];

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold">{n}. {title}</h2>
      {children}
    </section>
  );
}

export default function DataProcessingAgreement() {
  return (
    <main lang="en" dir="ltr" className="mx-auto grid max-w-3xl gap-6 px-4 py-12 leading-relaxed">
      <EnglishOnlyNotice />
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">Data processing agreement</h1>
        <p className="text-sm text-muted">Last updated: {UPDATED}</p>
        <p>
          This agreement (&ldquo;DPA&rdquo;) is part of the <Link className="underline" href="/terms">Terms of service</Link> between{" "}
          <strong>[COMPANY LEGAL NAME]</strong> (&ldquo;we&rdquo;, the <strong>processor</strong>) and the business using Relay (&ldquo;you&rdquo;,
          the <strong>controller</strong>). It applies whenever we process personal data on your behalf. By accepting the Terms you accept this DPA. If the
          two conflict on data protection, this DPA wins.
        </p>
      </header>

      <Section n="1" title="Definitions">
        <ul className="list-disc ps-6">
          <li><strong>Customer personal data:</strong> personal data we process for you through Relay, described in Annex 1.</li>
          <li><strong>Data protection law:</strong> every law that applies to that processing, including the UAE Personal Data Protection Law (Federal Decree-Law 45 of 2021) and, where they apply, the EU/UK GDPR, the Saudi PDPL, the Indian DPDP Act and the Turkish KVKK.</li>
          <li><strong>Subprocessor:</strong> a third party we engage to process customer personal data (Annex 3).</li>
          <li><strong>Security incident:</strong> a breach of security leading to accidental or unlawful destruction, loss, alteration, disclosure of, or access to customer personal data.</li>
        </ul>
      </Section>

      <Section n="2" title="Roles">
        <p>
          You decide why and how customer personal data is processed; we process it only to provide Relay. Meta (WhatsApp), Google, Microsoft, Shopify
          and other services <strong>you</strong> connect act under their own agreements with you, not as our subprocessors.
        </p>
      </Section>

      <Section n="3" title="Your instructions">
        <ul className="list-disc ps-6">
          <li>We process customer personal data only on your documented instructions. The Terms, this DPA, and your configuration and use of Relay are those instructions.</li>
          <li>If we believe an instruction breaks data protection law, we will tell you and may pause that processing.</li>
          <li>We do not sell customer personal data, use it for our own marketing, or use it to train AI models.</li>
        </ul>
      </Section>

      <Section n="4" title="Your responsibilities">
        <ul className="list-disc ps-6">
          <li>You have a lawful basis for the data you bring into Relay, including consent for marketing messages and for any contact lists you import.</li>
          <li>You give people the notices the law requires about how you use their data, including through Relay.</li>
          <li>You configure Relay appropriately (roles, retention, who can export) and keep your team&apos;s access up to date.</li>
        </ul>
      </Section>

      <Section n="5" title="Confidentiality">
        <p>
          Everyone at our company who can access customer personal data is bound by confidentiality, and only accesses it when needed: to give you support
          you asked for, for security, or when the law requires.
        </p>
      </Section>

      <Section n="6" title="Security">
        <p>We apply the technical and organisational measures in Annex 2, and may improve them over time, but never lower their overall level of protection.</p>
      </Section>

      <Section n="7" title="Subprocessors">
        <ul className="list-disc ps-6">
          <li>You authorise the subprocessors in Annex 3. Each is bound by a written contract with data protection obligations at least as strict as this DPA.</li>
          <li>We will give account owners <strong>at least 30 days&apos; notice</strong> before adding or replacing a subprocessor. If you object on reasonable data protection grounds and we cannot resolve it, you may end the affected service and receive a pro-rata refund of prepaid fees.</li>
          <li>We remain responsible to you for our subprocessors&apos; work.</li>
        </ul>
      </Section>

      <Section n="8" title="Helping you with people's requests">
        <p>
          Relay lets you find, export, correct and erase a contact&apos;s data yourself. If a person contacts us directly about data we hold for you, we
          will pass the request to you without undue delay and not answer it ourselves unless you ask us to.
        </p>
      </Section>

      <Section n="9" title="Security incidents">
        <ul className="list-disc ps-6">
          <li>We will notify the account owner <strong>without undue delay, and within 48 hours</strong> of confirming a security incident affecting your customer personal data.</li>
          <li>We will explain what happened, the data and people likely affected, the likely consequences, and what we are doing, and update you as we learn more.</li>
          <li>We will help you meet your own obligations to notify authorities and affected people. Notifying you is not an admission of fault.</li>
        </ul>
      </Section>

      <Section n="10" title="Assessments and audits">
        <p>
          We will give you the information reasonably needed to show we meet this DPA and to support your data protection impact assessments. Where the law
          gives you an audit right, you may audit us once a year with 30 days&apos; notice, at your cost, during business hours, through an independent auditor
          bound by confidentiality, in a way that does not expose other customers&apos; data.
        </p>
      </Section>

      <Section n="11" title="International transfers">
        <ul className="list-disc ps-6">
          <li>Customer personal data is stored in Frankfurt, Germany (EU). Some subprocessors process it in other countries (Annex 3).</li>
          <li>Where data protection law requires a transfer mechanism, we rely on it, for example the <strong>EU Standard Contractual Clauses</strong>, the <strong>Saudi SDAIA standard contractual clauses</strong>, or the <strong>Turkish KVKK standard contract</strong>, which are incorporated by reference where they apply. [COUNSEL TO CONFIRM MODULES AND ANY FILING DUTIES, e.g. KVKK notification within 5 business days.]</li>
        </ul>
      </Section>

      <Section n="12" title="Return and deletion">
        <p>
          While your account is active you can export and delete data at any time. When it ends, you have 90 days to export it; we then delete customer
          personal data, including from backups within a further 35 days, unless the law requires us to keep some of it, in which case we keep it
          confidential and use it only for that purpose.
        </p>
      </Section>

      <Section n="13" title="Liability and term">
        <p>This DPA lasts as long as we process customer personal data for you. Liability under it is subject to the limits in the Terms, except where data protection law does not allow such limits.</p>
      </Section>

      <section className="grid gap-3 border-t pt-6">
        <h2 className="text-xl font-semibold">Annex 1: Details of the processing</h2>
        <dl className="grid gap-2">
          <div><dt className="font-semibold">Subject matter and purpose</dt><dd>Providing Relay: receiving, storing, showing, routing and sending messages; customer records; deals, tasks, campaigns, reports; connected-service sync; AI features you use.</dd></div>
          <div><dt className="font-semibold">Duration</dt><dd>For the term of your subscription plus the 90-day export period, then deletion as in section 12.</dd></div>
          <div><dt className="font-semibold">People concerned</dt><dd>Your customers, leads and contacts who message you or whom you add; your staff and team members.</dd></div>
          <div><dt className="font-semibold">Types of data</dt><dd>Names, phone numbers, WhatsApp profile names, email addresses, message content and attachments (text, images, audio, video, documents, locations, contact cards), notes, deal and order details, and any custom fields you create.</dd></div>
          <div><dt className="font-semibold">Special categories</dt><dd>Not required by the service. If you choose to process them (for example health details at a clinic), you are responsible for the lawful basis and for configuring access appropriately.</dd></div>
        </dl>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Annex 2: Security measures</h2>
        <ul className="list-disc ps-6">
          <li>Encryption in transit (TLS) and at rest; connection tokens kept in an encrypted vault.</li>
          <li>Each business&apos;s data is isolated by database row-level security, tested automatically on every code change.</li>
          <li>Role-based access with team and ownership scopes; owner-only controls for exports, erasure, members and numbers.</li>
          <li>Append-only audit log of access-related changes; login alerts and two-factor sign-in.</li>
          <li>Inbound webhooks verified by signature before being accepted.</li>
          <li>Least-privilege staff access, used only for support, security or legal needs.</li>
          <li>Daily backups with tested restores; monitoring and error alerting.</li>
          <li>Documented incident response process.</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">Annex 3: Subprocessors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pe-4 text-start">Subprocessor</th>
                <th className="py-2 pe-4 text-start">Purpose</th>
                <th className="py-2 text-start">Location</th>
              </tr>
            </thead>
            <tbody>
              {SUBPROCESSORS.map(([name, purpose, where]) => (
                <tr key={name} className="border-b">
                  <td className="py-2 pe-4">{name}</td>
                  <td className="py-2 pe-4">{purpose}</td>
                  <td className="py-2">{where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm">
          Stripe processes billing data about you as our customer, not customer personal data, so it appears in the privacy policy rather than here.
        </p>
      </section>
    </main>
  );
}
