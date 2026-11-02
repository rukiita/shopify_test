import { expect, it } from "vitest";
import {
  buildOrdersCsv,
  type StoredExportOrder,
} from "../../app/lib/domain/orders-csv";

const COLUMNS = [
  "Order id",
  "Order number",
  "Total price",
  "Payment gateway",
  "Customer email",
  "Customer full name",
  "Customer address",
  "Tags",
  "Created at",
  "Product title",
  "Product tags",
];

type StoredLineItem = StoredExportOrder["lineItems"][number];

const lineItem = (overrides: Partial<StoredLineItem> = {}): StoredLineItem => ({
  title: "Title at purchase",
  product: { title: "Product title", tags: '["Winter"]' },
  ...overrides,
});

const order = (
  overrides: Partial<StoredExportOrder> = {},
): StoredExportOrder => ({
  id: "gid://shopify/Order/6663058751643",
  number: 1006,
  totalPriceMinor: 1199n,
  currencyCode: "USD",
  paymentGateways: '["bogus"]',
  customerEmail: "test.buyer@example.com",
  customerFullName: "Test Buyer",
  customerAddress: "123 Test Street",
  tags: '["VIP"]',
  shopifyCreatedAt: new Date("2026-11-02T13:05:00Z"),
  lineItems: [lineItem()],
  ...overrides,
});

// The lines of the file after the BOM, without the empty string after the last CRLF.
const lines = (csv: string) => csv.slice(1).split("\r\n").slice(0, -1);

// The raw text of the first data row, for tests of escaping.
const firstRow = (input: StoredExportOrder) =>
  lines(buildOrdersCsv([input]))[1];

// The value of a column in the first data row. Only for values that need no quoting
// and have no comma: the escaping has its own tests.
const cell = (input: StoredExportOrder, column: string) =>
  firstRow(input).split(",")[COLUMNS.indexOf(column)];

it("BE-5 CSV export : 1. writes the header row in CSV template order", () => {
  expect(lines(buildOrdersCsv([]))).toEqual([COLUMNS.join(",")]);
});

it("BE-5 CSV export : 1. starts with a UTF-8 BOM and ends rows with CRLF", () => {
  const csv = buildOrdersCsv([order()]);

  expect(csv.startsWith("\uFEFFOrder id,")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  expect(csv.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
});

it("BE-5 CSV export : 2. outputs Order id as the number in the GID", () => {
  expect(cell(order(), "Order id")).toBe("6663058751643");
});

it("BE-5 CSV export : 3. outputs Order number", () => {
  expect(cell(order(), "Order number")).toBe("1006");
});

it.each([
  [1199n, "USD", "11.99"],
  [1500n, "JPY", "1500"],
  [1234n, "KWD", "1.234"],
  [5n, "USD", "0.05"],
  [123456789012345678901n, "USD", "1234567890123456789.01"],
])(
  "BE-5 CSV export : 4. outputs Total price as a plain decimal (%s %s)",
  (totalPriceMinor, currencyCode, expected) => {
    expect(
      cell(order({ totalPriceMinor, currencyCode }), "Total price"),
    ).toBe(expected);
  },
);

it("BE-5 CSV export : 5. outputs Payment gateway", () => {
  expect(cell(order(), "Payment gateway")).toBe("bogus");
});

it("BE-5 CSV export : 5. joins multiple payment gateways with the separator", () => {
  expect(
    firstRow(order({ paymentGateways: '["bogus","manual"]' })),
  ).toContain(',"bogus, manual",');
});

it("BE-5 CSV export : 6. outputs Customer email, empty when there is none", () => {
  expect(cell(order(), "Customer email")).toBe("test.buyer@example.com");
  expect(cell(order({ customerEmail: null }), "Customer email")).toBe("");
});

it("BE-5 CSV export : 7. outputs Customer full name, empty when there is none", () => {
  expect(cell(order(), "Customer full name")).toBe("Test Buyer");
  expect(cell(order({ customerFullName: null }), "Customer full name")).toBe(
    "",
  );
});

it("BE-5 CSV export : 8. outputs Customer address, empty when there is none", () => {
  expect(cell(order(), "Customer address")).toBe("123 Test Street");
  expect(cell(order({ customerAddress: null }), "Customer address")).toBe("");
});

it("BE-5 CSV export : 9. outputs Tags", () => {
  expect(cell(order(), "Tags")).toBe("VIP");
});

it("BE-5 CSV export : 9. joins tags with the separator", () => {
  expect(firstRow(order({ tags: '["VIP","wholesale"]' }))).toContain(
    ',"VIP, wholesale",',
  );
});

it("BE-5 CSV export : 10. outputs Created at in UTC without milliseconds", () => {
  expect(
    cell(
      order({ shopifyCreatedAt: new Date("2026-11-02T22:05:00+09:00") }),
      "Created at",
    ),
  ).toBe("2026-11-02T13:05:00Z");
});

