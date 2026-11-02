// Converts a decimal amount string from Shopify ("11.99") to an integer in the
// currency's minor unit (1199n). Works on the digits of the string, never on a
// float, so the result is exact at any size.
export function toMinorUnits(amount: string, currencyCode: string): bigint {
  const fractionDigits = currencyFractionDigits(currencyCode);

  const match = /^(-?\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) {
    throw new Error(`Not a decimal amount: "${amount}"`);
  }
  const [, whole, fraction = ""] = match;

  // "1500.0" JPY is fine; "1.234" USD would lose a digit.
  if (/[1-9]/.test(fraction.slice(fractionDigits))) {
    throw new Error(
      `"${amount}" has more decimals than ${currencyCode} allows`,
    );
  }

  return BigInt(
    whole + fraction.slice(0, fractionDigits).padEnd(fractionDigits, "0"),
  );
}

// Formats an amount in the currency's minor unit for display: 1199n USD -> "$11.99".
// Works on the digits, never on a float, so the result is exact at any size.
export function formatMoney(minorUnits: bigint, currencyCode: string): string {
  const fractionDigits = currencyFractionDigits(currencyCode);
  const digits = (minorUnits < 0n ? -minorUnits : minorUnits)
    .toString()
    .padStart(fractionDigits + 1, "0");
  const whole = digits.slice(0, digits.length - fractionDigits);
  const fraction = digits.slice(digits.length - fractionDigits);
  const decimal = `${minorUnits < 0n ? "-" : ""}${whole}.${fraction}`;

  // format() reads a decimal string exactly (ES2023; the app runs on Node 22 or
  // later). The cast is needed because tsconfig's ES2022 lib only declares numbers.
  return currencyFormat(currencyCode).format(decimal as unknown as number);
}

const currencyFormat = (currencyCode: string) =>
  new Intl.NumberFormat("en", { style: "currency", currency: currencyCode });

function currencyFractionDigits(currencyCode: string) {
  const fractionDigits =
    currencyFormat(currencyCode).resolvedOptions().maximumFractionDigits;
  // Never undefined with style "currency" (an invalid code already throws a
  // RangeError above); the check only narrows the type, which declares it optional.
  if (fractionDigits === undefined) {
    throw new Error(`Unknown number of decimals for ${currencyCode}`);
  }
  return fractionDigits;
}
