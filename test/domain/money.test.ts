import { expect, it } from "vitest";
import { toMinorUnits } from "../../app/lib/domain/money";

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
