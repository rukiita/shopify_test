import { expect, it } from "vitest";
import { formatMoney, toMinorUnits } from "../../app/lib/domain/money";

it("BE-1 Webhook ingestion : 1. converts the total to minor units without floating point", () => {
  expect(toMinorUnits("11.99", "USD")).toBe(1199n);
  expect(toMinorUnits("1.0", "USD")).toBe(100n);
  expect(toMinorUnits("0.29", "USD")).toBe(29n); // 0.29 * 100 is 28.999999999999996 as a float
  expect(toMinorUnits("1500", "JPY")).toBe(1500n);
  expect(toMinorUnits("1500.0", "JPY")).toBe(1500n);
  expect(toMinorUnits("1.234", "KWD")).toBe(1234n);
  // Above Number.MAX_SAFE_INTEGER in minor units.
  expect(toMinorUnits("90071992547409.93", "USD")).toBe(9_007_199_254_740_993n);
  // Digits the currency does not have would be lost.
  expect(() => toMinorUnits("1.234", "USD")).toThrow();
});

it("BE-2 Order list : 1. formats a total from minor units without floating point", () => {
  expect(formatMoney(1199n, "USD")).toBe("$11.99");
  expect(formatMoney(100n, "USD")).toBe("$1.00");
  expect(formatMoney(5n, "USD")).toBe("$0.05");
  expect(formatMoney(0n, "USD")).toBe("$0.00");
  expect(formatMoney(-5n, "USD")).toBe("-$0.05");
  expect(formatMoney(1500n, "JPY")).toBe("¥1,500");
  expect(formatMoney(1234n, "KWD")).toBe("KWD 1.234");
  // Above Number.MAX_SAFE_INTEGER in minor units.
  expect(formatMoney(9_007_199_254_740_993n, "USD")).toBe(
    "$90,071,992,547,409.93",
  );
});
