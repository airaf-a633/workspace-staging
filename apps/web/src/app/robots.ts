import type { MetadataRoute } from "next";
import { previewMode } from "@/lib/preview-gate";

/* The partner preview is never indexed. The real site keeps the app and the preview out of search. */
export default function robots(): MetadataRoute.Robots {
  if (previewMode()) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/", disallow: ["/app", "/w/", "/preview", "/invite", "/api"] } };
}
