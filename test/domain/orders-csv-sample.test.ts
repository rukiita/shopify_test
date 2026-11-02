import { readFileSync, writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import {
  buildOrdersCsv,
  type StoredExportOrder,
} from "../../app/lib/domain/orders-csv";

const SAMPLE_PATH = new URL("../../samples/orders.csv", import.meta.url);

const json = JSON.stringify;

const order = (
  number: number,
  createdAt: string,
  totalPriceMinor: bigint,
  fields: Partial<StoredExportOrder>,
  lineItems: StoredExportOrder["lineItems"],
): StoredExportOrder => ({
  id: `gid://shopify/Order/66630587${number}00`,
  number,
  totalPriceMinor,
  currencyCode: "USD",
  paymentGateways: json(["bogus"]),
  customerEmail: "test.buyer@example.com",
  customerFullName: "Test Buyer",
  customerAddress:
    "123 Test Street, Apt 4, San Francisco CA 94103, United States",
  tags: "[]",
  shopifyCreatedAt: new Date(createdAt),
  lineItems,
  ...fields,
});

const product = (title: string, tags: string[], quantity = 1) => ({
  title: "",
  quantity,
  product: { title, tags: json(tags) },
});

// Made-up test data only (SECURITY_REVIEW.md §4).
const SAMPLE_ORDERS = [
  // Several line items and several tags. The line item with quantity 0 has no row.
  order(
    1005,
    "2026-11-01T05:17:27Z",
    138595n,
    { tags: json(["Snowboard", "VIP"]) },
    [
      product("The Compare at Price Snowboard", [
        "Accessory",
        "Sport",
        "Winter",
      ]),
      product("The Collection Snowboard: Hydrogen", ["Accessory", "Snowboard"]),
      product("Test Board Removed by an Order Edit", ["Winter"], 0),
    ],
  ),
  // Commas, quotes and a semicolon, and two payment gateways.
  order(
    1004,
    "2026-11-01T04:02:10Z",
    24950n,
    {
      paymentGateways: json(["bogus", "manual"]),
      customerFullName: 'Test "Ace" Customer',
      customerEmail: "test.customer@example.com",
      customerAddress: "456 Test Avenue; Building B, Test City, United States",
    },
    [product('Test Board 5" Deck, Limited Edition', ["Winter"])],
  ),
  // Cells a spreadsheet would run as formulas.
  order(
    1003,
    "2026-11-01T03:45:00Z",
    1199n,
    {
      customerFullName: "=Test Formula",
      tags: json(["=SUM(1,2)", "wholesale"]),
    },
    [product("-Test Clearance Wax", ["@sale"])],
  ),
  // The products were deleted: the title at purchase, and no product tags.
  order(
    1002,
    "2026-11-01T03:18:30Z",
    2495n,
    {
      paymentGateways: json(["manual"]),
      customerFullName: "テスト 顧客",
      customerEmail: "test.japan@example.com",
      customerAddress: "1-2-3 テスト町, 東京都 100-0001, Japan",
    },
    [
      { title: "Selling Plans Ski Wax", quantity: 1, product: null },
      { title: "テスト", quantity: 1, product: null },
    ],
  ),
  // No customer.
  order(
    1001,
    "2026-11-01T02:00:05Z",
    2495n,
    {
      paymentGateways: json(["manual"]),
      customerEmail: null,
      customerFullName: null,
      customerAddress: null,
    },
    [product("Selling Plans Ski Wax", ["Accessory"])],
  ),
];

// After a change of the format, write the file again with
// UPDATE_SAMPLE=1 npx vitest run test/domain/orders-csv-sample.test.ts
it("BE-5 CSV export : 1. samples/orders.csv is what the export writes for the sample orders", () => {
  const csv = Buffer.from(buildOrdersCsv(SAMPLE_ORDERS));
  // eslint-disable-next-line no-undef
  if (process.env.UPDATE_SAMPLE) {
    writeFileSync(SAMPLE_PATH, csv);
  }

  // Compared as bytes, so that the BOM and the line endings count.
  expect(readFileSync(SAMPLE_PATH).equals(csv)).toBe(true);
});
