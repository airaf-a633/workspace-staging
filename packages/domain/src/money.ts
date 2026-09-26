/**
 * Money is stored and computed as integer fils (1 AED = 100 fils).
 * Never use floating point for amounts.
 */
export type Fils = number & { readonly __brand: "Fils" };

export function fils(value: number): Fils {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Fils must be a safe integer, got ${value}`);
  }
  return value as Fils;
}

/** Parses user input like "12", "12.5", "12.50", "1,250.75" into fils. */
export function parseAed(input: string): Fils {
  const cleaned = input.trim().replace(/,/g, "");
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) throw new RangeError(`Not a valid AED amount: "${input}"`);
  const [, sign, whole, frac = ""] = match;
  const value = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return fils(sign ? -value : value);
}

export function addFils(...amounts: Fils[]): Fils {
  return fils(amounts.reduce<number>((sum, a) => sum + a, 0));
}

export function multiplyFils(unit: Fils, qty: number): Fils {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new RangeError(`Quantity must be a non-negative integer, got ${qty}`);
  }
  return fils(unit * qty);
}

/** Formats fils for display, e.g. 125075 -> "1,250.75". Currency label is added by the UI per locale. */
export function formatAed(amount: Fils, locale = "en-AE"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    numberingSystem: "latn",
  }).format(amount / 100);
}
