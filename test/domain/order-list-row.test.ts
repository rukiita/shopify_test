import { expect, it } from "vitest";
import {
  formatOrderDate,
  toOrderListRow,
} from "../../app/lib/domain/order-list-row";

const stored = {
  id: "gid://shopify/Order/1",
  name: "#1001",
  shopifyCreatedAt: new Date("2026-11-01T05:17:27Z"),
  customerFullName: "Test Buyer",
  customerEmail: "test.buyer@example.com",
  totalPriceMinor: 9_007_199_254_740_993n,
  currencyCode: "USD",
  paymentGateways: JSON.stringify(["bogus", "manual"]),
  tags: JSON.stringify(["VIP", "a, b"]),
};

it("BE-2 Order list : 1. a row has no bigint and survives JSON.stringify", () => {
  const row = toOrderListRow(stored);

  expect(JSON.parse(JSON.stringify(row))).toEqual({
    id: "gid://shopify/Order/1",
    name: "#1001",
    createdAt: "2026-11-01T05:17:27.000Z",
    customerName: "Test Buyer",
    customerEmail: "test.buyer@example.com",
    total: "$90,071,992,547,409.93",
    paymentGateways: ["bogus", "manual"],
    tags: ["VIP", "a, b"],
  });
});

it("BE-2 Order list : 1. shows the created time in the given time zone", () => {
  const createdAt = "2026-11-01T20:17:27.000Z";

  expect(formatOrderDate(createdAt, "UTC")).toBe("Nov 1, 2026, 8:17 PM");
  expect(formatOrderDate(createdAt, "Asia/Tokyo")).toBe("Nov 2, 2026, 5:17 AM");
});
