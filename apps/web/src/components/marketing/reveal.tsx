"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fades `.reveal` elements in once as they scroll into view. One observer for the whole page.
 * CSS keeps them visible when scripts are off or reduced motion is on.
 */
export function RevealOnScroll() {
  const path = usePathname();
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".reveal:not(.is-in)");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [path]);
  return null;
}
