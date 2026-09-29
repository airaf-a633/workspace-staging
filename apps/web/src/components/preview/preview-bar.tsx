"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Eye } from "@phosphor-icons/react";

/** The strip above every preview screen: what this is, and who you're viewing as. */
export function PreviewBar({ current, people }: { current: string; people: { key: string; name: string; role: string }[] }) {
  const path = usePathname();
  const router = useRouter();

  function switchTo(key: string) {
    // Keep the same screen, swap the person: /preview/priya/inbox -> /preview/sara/inbox
    router.push(path.replace(`/preview/${current}`, `/preview/${key}`) + window.location.search);
  }

  return (
    <div className="bg-hero flex min-h-10 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1 text-sm text-white">
      <p className="flex items-center gap-2">
        <Eye size={18} aria-hidden="true" />
        <span><strong className="font-semibold">Preview</strong><span className="hidden sm:inline"> · sample data, nothing is saved</span></span>
      </p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-white/80">Viewing as</span>
          <select
            value={current}
            onChange={(e) => switchTo(e.target.value)}
            className="glass min-h-8 rounded-full px-3 text-sm text-white [&>option]:text-[#0F2537]"
          >
            {people.map((p) => (
              <option key={p.key} value={p.key}>{p.name}, {p.role}</option>
            ))}
          </select>
        </label>
        <Link href="/preview" className="text-white/85 underline-offset-4 hover:underline">All screens</Link>
      </div>
    </div>
  );
}
