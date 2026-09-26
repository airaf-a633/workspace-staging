/**
 * Normalises phone numbers to E.164 digits without "+", the format WhatsApp uses for wa_id.
 * Local UAE formats (05x..., 5x...) get the 971 country code.
 */
export function toWaId(input: string, defaultCountryCode = "971"): string {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = defaultCountryCode + digits.slice(1);
  else if (digits.length === 9 && defaultCountryCode === "971") digits = "971" + digits;

  if (!/^\d{8,15}$/.test(digits)) {
    throw new RangeError(`Not a valid phone number: "${input}"`);
  }
  return digits;
}
