import type { Metadata } from "next";
import Link from "next/link";

/*
 * DRAFT terms of service, written 2026-09-28. Must be reviewed by a UAE lawyer before launch.
 * Everything in [SQUARE BRACKETS] is a placeholder the founder must fill in.
 */

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Workspace.",
};

const UPDATED = "28 September 2026";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold">{n}. {title}</h2>
      {children}
    </section>
  );
}

export default function Terms() {
  return (
    <main className="mx-auto grid max-w-3xl gap-6 px-4 py-12 leading-relaxed">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">Terms of service</h1>
        <p className="text-sm text-slate-600">Last updated: {UPDATED}</p>
        <p>
          These terms are an agreement between <strong>[COMPANY LEGAL NAME]</strong> ([FREE ZONE], United Arab Emirates, licence{" "}
          <strong>[LICENCE NUMBER]</strong>) (&ldquo;we&rdquo;) and the business that creates a Workspace account (&ldquo;you&rdquo;). By creating an
          account or using Workspace you agree to them on behalf of your business, and you confirm you are allowed to do so.
        </p>
      </header>

      <Section n={1} title="The service">
        <p>
          Workspace lets your team manage WhatsApp and email conversations, customer records, deals, tasks, campaigns and connected tools in one place. We
          may improve or change features; if a change significantly reduces what you pay for, we will tell you in advance.
        </p>
      </Section>

      <Section n={2} title="Your account and team">
        <ul className="list-disc ps-6">
          <li>You must give accurate details and keep them up to date.</li>
          <li>The account owner controls who joins, their roles and what they can see. You are responsible for everything your team members do in Workspace.</li>
          <li>Keep sign-in details secret, turn on two-factor sign-in when available, and tell us straight away about any unauthorised access.</li>
          <li>You must be a business and at least 18 years old. Workspace is not for personal or consumer use.</li>
        </ul>
      </Section>

      <Section n={3} title="WhatsApp and other third-party services">
        <ul className="list-disc ps-6">
          <li>
            Using WhatsApp through Workspace also means agreeing to Meta&apos;s WhatsApp Business terms and policies, including the{" "}
            <a className="underline" href="https://business.whatsapp.com/policy">WhatsApp Business Messaging Policy</a>. You are responsible for
            following them.
          </li>
          <li>
            <strong>Meta charges for WhatsApp messages separately.</strong> Those charges are between you and Meta. We show estimates in the app but add no
            markup, and we are not responsible for Meta&apos;s prices or their changes.
          </li>
          <li>
            Meta, Google, Microsoft, Shopify and other providers can change, limit or suspend their services, including restricting or banning a WhatsApp
            number because of its quality rating or policy violations. We do not control those decisions and cannot guarantee a number will stay active.
          </li>
          <li>Connected services are used under their own terms. You can disconnect them at any time.</li>
        </ul>
      </Section>

      <Section n={4} title="Acceptable use">
        <p>You must not use Workspace to:</p>
        <ul className="list-disc ps-6">
          <li>send marketing to people who have not agreed to receive it, or keep messaging people who opted out;</li>
          <li>send spam, scams, phishing, harassment, or illegal, misleading or harmful content;</li>
          <li>sell restricted goods or services that WhatsApp or UAE law prohibits;</li>
          <li>break the law, including UAE data protection, telecommunications and consumer protection laws;</li>
          <li>try to access other businesses&apos; data, break our security, overload the service, or copy or resell it without our written agreement.</li>
        </ul>
        <p>
          <strong>Imported contact lists:</strong> before sending campaigns to a list you import, you confirm you have each person&apos;s consent to receive
          your messages on WhatsApp, and you record where that consent came from. You are responsible for that consent.
        </p>
      </Section>

      <Section n={5} title="Your data">
        <ul className="list-disc ps-6">
          <li>You own your data and your customers&apos; data. We use it only to provide Workspace to you, as described in our{" "}
            <Link className="underline" href="/privacy">Privacy policy</Link> and our Data Processing Agreement, which forms part of these terms.</li>
          <li>You are responsible for having a lawful basis to collect and use your customers&apos; personal data, and for answering their requests about it.</li>
          <li>You can export your data at any time while your account is active, and for 90 days after it ends. After that we delete it, except where the law requires us to keep it.</li>
        </ul>
      </Section>

      <Section n={6} title="AI features">
        <p>
          AI suggestions, summaries and translations can be wrong. Review them before relying on them or sending them. If you turn on automatic out-of-hours
          replies, you are responsible for what they say to your customers and for keeping the business information they use accurate.
        </p>
      </Section>

      <Section n={7} title="Plans, payment and cancellation">
        <ul className="list-disc ps-6">
          <li>New accounts get a 14-day free trial. No card is needed to start.</li>
          <li>Paid plans are billed in advance, monthly or yearly, in AED, and renew automatically until cancelled. Prices exclude VAT where it applies.</li>
          <li>You can cancel at any time in Settings. Cancellation takes effect at the end of the current billing period. Fees already paid are not refunded, except where the law requires.</li>
          <li>If a payment fails, you keep full access for 7 days while we remind you. After that the workspace becomes read-only until payment is made.</li>
          <li>We may change prices with at least 30 days&apos; notice before your next renewal.</li>
        </ul>
      </Section>

      <Section n={8} title="Suspension and termination">
        <p>
          We may suspend or close an account that seriously or repeatedly breaks these terms, puts other users or the service at risk, or does not pay. Where
          possible we will warn you first and give you a chance to fix the problem. You may close your account at any time.
        </p>
      </Section>

      <Section n={9} title="Our intellectual property">
        <p>
          Workspace, its software and its brand belong to us. You get a non-exclusive, non-transferable right to use it for your business while your
          subscription is active. If you send us feedback, we may use it without owing you anything.
        </p>
      </Section>

      <Section n={10} title="Availability and warranties">
        <p>
          We work to keep Workspace available and secure, but it is provided &ldquo;as is&rdquo;. We do not promise it will be uninterrupted or error-free,
          and we are not responsible for outages or changes of third-party services such as WhatsApp.
        </p>
      </Section>

      <Section n={11} title="Limitation of liability">
        <p>
          As far as the law allows, we are not liable for indirect or consequential losses, such as lost profits, lost sales or lost data. Our total liability
          for any claim relating to Workspace is limited to the fees you paid us in the 12 months before the claim. Nothing in these terms limits liability
          that cannot be limited by law.
        </p>
      </Section>

      <Section n={12} title="Indemnity">
        <p>
          You will cover our reasonable losses and costs if a third party makes a claim against us because of your content, your messages, or your breach of
          these terms or of the law.
        </p>
      </Section>

      <Section n={13} title="Changes to these terms">
        <p>
          We may update these terms. If a change matters, we will tell account owners by email and in the app at least 30 days before it takes effect. Continuing
          to use Workspace after that means you accept the new terms.
        </p>
      </Section>

      <Section n={14} title="Governing law and disputes">
        <p>
          These terms are governed by the laws of <strong>[THE EMIRATE OF DUBAI AND THE FEDERAL LAWS OF THE UAE / THE FREE ZONE&apos;S LAW, TO BE CONFIRMED BY
          COUNSEL]</strong>. Disputes go to the courts of <strong>[TO BE CONFIRMED BY COUNSEL]</strong>. We will always try to settle a problem with you directly first.
        </p>
      </Section>

      <Section n={15} title="Contact">
        <p>
          <strong>[COMPANY LEGAL NAME]</strong>, <strong>[REGISTERED ADDRESS]</strong>. Email: <strong>support@[YOUR-DOMAIN]</strong>.
        </p>
      </Section>
    </main>
  );
}
