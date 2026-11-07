/**
 * The currencies a workspace can choose (decided 2026-11-03). Only ones with two decimal places: amounts are stored in the
 * smallest unit (cents), which would be wrong for currencies with none or three (yen, dinar).
 */
export const CURRENCIES = ["USD", "EUR", "GBP", "AED", "SAR", "QAR", "EGP", "INR", "PKR", "CAD", "AUD", "NZD", "SGD", "MYR", "CHF", "SEK", "NOK", "DKK", "ZAR"];

/** "US dollar (USD)", in the reader's language. */
export function currencyName(code: string, locale = "en"): string {
  try {
    return `${new Intl.DisplayNames(locale, { type: "currency" }).of(code) ?? code} (${code})`;
  } catch {
    return code;
  }
}
