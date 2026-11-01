// Converts a decimal amount string from Shopify ("11.99") to an integer in the
// currency's minor unit (1199n).
export function toMinorUnits(amount: string, currencyCode: string): bigint {
  const fractionDigits = 2;
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole + fraction.padEnd(fractionDigits, "0"));
}
