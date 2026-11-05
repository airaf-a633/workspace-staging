/**
 * Who is behind Relay, for the Terms, the Privacy policy and the Data processing agreement. Fill these in once (founder, before the
 * pilot launch) and every page shows them. Anything left empty shows its [SQUARE BRACKET] placeholder, so an unfinished page is
 * obvious rather than quietly wrong. These pages are drafts until a lawyer has read them.
 */
export const COMPANY = {
  /** The full registered name, e.g. "Relay Technologies FZ-LLC". */
  legalName: "",
  /** The free zone it is registered in. */
  freeZone: "",
  licenceNumber: "",
  /** The registered address, on one line. */
  address: "",
  /** The domain emails come from, without "@", e.g. "relay.example". support@ and privacy@ are built from it. */
  domain: "",
};

const PLACEHOLDER: Record<keyof typeof COMPANY, string> = {
  legalName: "[COMPANY LEGAL NAME]",
  freeZone: "[FREE ZONE]",
  licenceNumber: "[LICENCE NUMBER]",
  address: "[REGISTERED ADDRESS]",
  domain: "[YOUR-DOMAIN]",
};

export function company(key: keyof typeof COMPANY): string {
  return COMPANY[key].trim() || PLACEHOLDER[key];
}
