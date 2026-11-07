import "server-only";

/** The request's "now" for server pages (times like "2 min ago" are worked out from it). */
export function requestNow() {
  return Date.now();
}
