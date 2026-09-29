"use client";

import Link from "next/link";
import { useState } from "react";
import { Circle } from "@phosphor-icons/react";
import { buttonClass } from "@/components/ui/button";

type Shape = "solo" | "small" | "split" | "delivery";

const SHAPES: [Shape, string, string][] = [
  ["solo", "Just me", "I handle customers myself"],
  ["small", "A small team", "2 to 5 people sharing the work"],
  ["split", "Separate sales and support", "Different people for new customers and existing ones"],
  ["delivery", "We also deliver orders", "Our own riders or drivers take orders to customers"],
];

/* Workspace creation and the setup checklist it shapes (PRODUCT_DECISIONS §14), without saving anything. */
export function PreviewOnboarding() {
  const [step, setStep] = useState<"create" | "checklist">("create");
  const [name, setName] = useState("Qamar Electronics");
  const [shape, setShape] = useState<Shape | null>(null);

  if (step === "create") {
    return (
      <form
        className="grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          setStep("checklist");
        }}
      >
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Business name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required className="min-h-11 rounded-[var(--radius-control)] border border-input bg-surface px-3 text-base" />
        </label>
        <fieldset className="grid gap-1">
          <legend className="text-sm font-medium">What does your team look like? <span className="font-normal text-muted">(optional)</span></legend>
          <p className="text-sm text-muted">We&apos;ll tailor your setup steps. You can change this later.</p>
          <div className="mt-2 grid gap-2">
            {SHAPES.map(([value, title, hint]) => (
              <label key={value} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-[var(--radius-control)] border border-border p-3 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
                <input type="radio" name="teamShape" checked={shape === value} onChange={() => setShape(value)} className="mt-1 size-5 accent-[var(--primary)]" />
                <span className="grid">
                  <span className="font-medium">{title}</span>
                  <span className="text-sm text-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className={buttonClass("primary", "md", "w-full")}>Create workspace</button>
      </form>
    );
  }

  const steps = [
    { title: "Connect WhatsApp", body: "Link your business number and keep using the WhatsApp app on your phone.", soon: "Opens as soon as Meta approves our platform. We'll email you. Your trial starts then." },
    {
      title: shape === "solo" ? "Invite your team (optional)" : "Invite your team",
      body: shape === "solo" ? "Skip this if it's just you. You can add people any time." : shape === "split" ? "Add your sales and support managers, then put each in their own team." : "Add managers and agents, and choose what each can see.",
      soon: null,
    },
    { title: "Set working hours", body: "So customers get an out-of-hours reply and reply targets are fair.", soon: "Coming soon" },
    { title: "Import your customers", body: "Upload a spreadsheet or bring contacts from your phone.", soon: "Coming soon" },
    { title: "Connect your store and email", body: "Shopify or WooCommerce orders and Outlook or Gmail, next to every chat.", soon: "Coming soon" },
  ];

  return (
    <div className="grid gap-5">
      <p className="text-muted">
        <strong className="font-medium text-text">{name || "Your business"}</strong> is ready. Here&apos;s what&apos;s left to set up. Skip anything you don&apos;t need.
      </p>
      <ol className="grid gap-1">
        {steps.map((s) => (
          <li key={s.title} className="flex items-start gap-3 rounded-[var(--radius-control)] p-3">
            <Circle size={24} className="mt-0.5 shrink-0 text-muted" aria-hidden="true" />
            <span className="grid gap-0.5">
              <span className="font-medium">{s.title}</span>
              <span className="text-sm text-muted">{s.body}</span>
              {s.soon && <span className="text-sm italic text-muted">{s.soon}</span>}
            </span>
          </li>
        ))}
      </ol>
      {shape === "delivery" && (
        <p className="rounded-[var(--radius-control)] bg-surface-2 p-3 text-sm">You said you deliver orders. The Orders &amp; Delivery add-on handles dispatch, a rider page and end-of-day cash. It becomes available after launch.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Link href="/preview/khalid" className={buttonClass("primary")}>See the owner&apos;s home</Link>
        <button type="button" onClick={() => setStep("create")} className={buttonClass("ghost")}>Back</button>
      </div>
    </div>
  );
}
