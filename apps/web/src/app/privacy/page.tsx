import type { Metadata } from "next";

/*
 * DRAFT privacy policy, written 2026-09-28. Must be reviewed by a UAE lawyer before launch.
 * Everything in [SQUARE BRACKETS] is a placeholder the founder must fill in.
 * Keep the Google "Limited Use" wording exactly as written: Google's verification checks for it.
 */

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Workspace collects, uses and protects personal data.",
};

const UPDATED = "28 September 2026";

const SUBPROCESSORS = [
  ["Supabase Inc.", "Database, sign-in and file storage", "Germany (Frankfurt, EU)"],
  ["Vercel Inc.", "Hosting of the web application", "Germany (Frankfurt, EU)"],
  ["Fly.io Inc.", "Background processing", "Germany (Frankfurt, EU)"],
  ["Meta Platforms Ireland Ltd.", "WhatsApp Business Platform (message delivery)", "EU and Meta's global infrastructure"],
  ["Anthropic PBC", "AI features (reply suggestions, summaries, translation)", "United States"],
  ["Stripe Payments Europe Ltd.", "Subscription billing", "EU and United States"],
  ["Nango (Nango Inc.)", "Secure connections to email, calendar and store accounts", "EU and United States"],
  ["Sentry (Functional Software Inc.)", "Error monitoring", "EU and United States"],
];

export default function PrivacyPolicy() {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12 leading-relaxed">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">Privacy policy</h1>
        <p className="text-sm text-slate-600">Last updated: {UPDATED}</p>
      </header>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">1. Who we are</h2>
        <p>
          Workspace (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is a business messaging and customer management service operated by{" "}
          <strong>[COMPANY LEGAL NAME]</strong>, a company registered in <strong>[FREE ZONE], United Arab Emirates</strong>, licence number{" "}
          <strong>[LICENCE NUMBER]</strong>, with its address at <strong>[REGISTERED ADDRESS]</strong>.
        </p>
        <p>
          Questions about this policy or your data: <strong>privacy@[YOUR-DOMAIN]</strong>.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">2. Two roles: our customers and their customers</h2>
        <ul className="list-disc ps-6">
          <li>
            <strong>Businesses that use Workspace</strong> (&ldquo;our customers&rdquo;) and their staff: we decide how their account data is used,
            so for that data we are the <strong>controller</strong>.
          </li>
          <li>
            <strong>People who message those businesses</strong> (&ldquo;end customers&rdquo;): the business decides why and how their messages and
            details are used. We process that data <strong>only on the business&apos;s instructions</strong>, as its <strong>processor</strong>, under our
            Data Processing Agreement. If you messaged a business that uses Workspace, contact that business first about your data; we will help them
            respond.
          </li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">3. What we collect</h2>
        <ul className="list-disc ps-6">
          <li><strong>Account data:</strong> name, work email, password (stored only as a secure hash), role, team, language preference.</li>
          <li><strong>Business data:</strong> business name, WhatsApp Business Account and phone number identifiers, billing details (handled by Stripe; we never see full card numbers).</li>
          <li>
            <strong>Conversation data (as processor):</strong> WhatsApp and email messages, attachments, contact names and numbers, notes, deals, tasks and
            order history that the business chooses to connect or create.
          </li>
          <li><strong>Connected accounts (only when a user connects them):</strong> email, calendar and online store data described in section 5.</li>
          <li><strong>Usage and security data:</strong> sign-in times, IP address, device and browser type, actions recorded in the audit log, error reports.</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">4. How we use it</h2>
        <ul className="list-disc ps-6">
          <li>To provide the service: show, send and route messages, keep customer records, run the automations and reports the business sets up.</li>
          <li>To keep accounts secure: sign-in, permission checks, fraud and abuse prevention, audit logs.</li>
          <li>To bill our customers and meet legal and tax obligations.</li>
          <li>To support our customers when they ask for help.</li>
          <li>To improve the service using aggregated, de-identified usage statistics.</li>
        </ul>
        <p>
          <strong>We do not sell personal data, and we do not use end customers&apos; messages for advertising.</strong> We do not use any customer&apos;s
          data to train AI models.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">5. Connected services</h2>
        <h3 className="font-semibold">WhatsApp (Meta)</h3>
        <p>
          Messages are sent and received through Meta&apos;s WhatsApp Business Platform, under Meta&apos;s own terms and privacy policy. Meta processes
          messages to deliver them and may charge the business for them.
        </p>
        <h3 className="font-semibold">Google (Gmail, Google Calendar, Google sign-in)</h3>
        <p>
          If a user connects a Google account, we request only the access needed for the features they turn on: sending email from Gmail on their behalf,
          reading and updating their calendar events for tasks and bookings, and signing in.
        </p>
        <p>
          <strong>
            Workspace&apos;s use and transfer to any other app of information received from Google APIs will adhere to the{" "}
            <a className="underline" href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
            including the Limited Use requirements.
          </strong>{" "}
          We do not use Google user data to develop, improve or train generalised AI or machine-learning models, we do not sell it, and people at our company
          do not read it unless the user asks us to for support, it is needed for security, or the law requires it.
        </p>
        <h3 className="font-semibold">Microsoft (Outlook and Microsoft 365)</h3>
        <p>If a user connects a Microsoft account, we sync the mailboxes and calendars they choose, only to show them in Workspace.</p>
        <h3 className="font-semibold">Shopify and WooCommerce</h3>
        <p>If a business connects its store, we read customers and orders to show them next to conversations and to run the automations the business sets up.</p>
        <p>Users can disconnect any of these at any time in Settings; we then stop syncing and delete the access tokens.</p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">6. AI features</h2>
        <p>
          When a user asks for a reply suggestion, summary or translation, the relevant conversation text is sent to our AI provider (Anthropic) to produce
          the result. The provider does not keep the data after processing and does not use it for training. A person always reviews AI suggestions before
          they are sent, except where the business turns on out-of-hours automatic replies, which are marked as automated.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">7. Who we share data with</h2>
        <p>Only with the service providers below, bound by contracts that limit their use of the data to providing their service to us:</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-start">
                <th className="py-2 pe-4 text-start">Provider</th>
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
        <p>We may also disclose data when the law requires it, or to protect the rights and safety of our users and the public.</p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">8. Where data is stored and international transfers</h2>
        <p>
          Our main database and files are hosted in <strong>Frankfurt, Germany (EU)</strong>. Some providers above process data in other countries. Where data
          leaves the UAE or the EU, we rely on the safeguards required by the applicable law, such as standard contractual clauses.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">9. How long we keep data</h2>
        <ul className="list-disc ps-6">
          <li>Conversation data is kept until the business deletes it. Business owners can set automatic deletion after 1, 2 or 5 years.</li>
          <li>If a subscription ends, data is kept for 90 days so the business can return or export it, then deleted.</li>
          <li>Audit logs and billing records are kept as long as the law requires.</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">10. Your rights</h2>
        <p>
          Depending on where you live (including under the UAE Personal Data Protection Law and, for people in the EU, the GDPR), you may have the right to
          access, correct, delete or export your personal data, to object to or restrict its use, and to withdraw consent. Email{" "}
          <strong>privacy@[YOUR-DOMAIN]</strong>. If your request is about messages you sent to a business, we will pass it to that business and help it
          respond. You may also complain to your data protection authority.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">11. Security</h2>
        <p>
          Data is encrypted in transit and at rest. Access inside each business is limited by role, every access-related change is logged, and connection
          tokens are kept in an encrypted vault. No system is perfectly secure; if a breach affects your data, we will notify you and the authorities as the
          law requires.
        </p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">12. Children</h2>
        <p>Workspace is a business service and is not meant for anyone under 18.</p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">13. Cookies</h2>
        <p>We use only the cookies needed to keep you signed in and secure. We do not use advertising cookies.</p>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-semibold">14. Changes</h2>
        <p>If we change this policy in a way that matters, we will tell account owners by email and in the app before it takes effect.</p>
      </section>
    </main>
  );
}
