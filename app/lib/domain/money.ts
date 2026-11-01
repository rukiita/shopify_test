// Converts a decimal amount string from Shopify ("11.99") to an integer in the
// currency's minor unit (1199n). Works on the digits of the string, never on a
// float, so the result is exact at any size.
export function toMinorUnits(amount: string, currencyCode: string): bigint {
  const fractionDigits = new Intl.NumberFormat("en", {
    style: "currency",
    currency: currencyCode,
  }).resolvedOptions().maximumFractionDigits;
  if (fractionDigits === undefined) {
    throw new Error(`Unknown number of decimals for ${currencyCode}`);
  }

  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) {
    throw new Error(`Not a decimal amount: "${amount}"`);
  }
  const [, whole, fraction = ""] = match;

  // "1500.0" JPY is fine; "1.234" USD would lose a digit.
  if (/[1-9]/.test(fraction.slice(fractionDigits))) {
    throw new Error(`"${amount}" has more decimals than ${currencyCode} allows`);
  }

  return BigInt(whole + fraction.slice(0, fractionDigits).padEnd(fractionDigits, "0"));
}
