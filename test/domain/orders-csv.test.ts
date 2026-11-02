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

it("BE-5 CSV export : 1. escapes values containing commas, quotes and line breaks", () => {
  const row = firstRow(
    order({
      customerFullName: 'Test "Ace" Buyer',
      customerAddress: "123 Test Street, San Francisco",
      customerEmail: null,
      tags: "[]",
      lineItems: [lineItem({ product: { title: "Line\nbreak", tags: "[]" } })],
    }),
  );

  expect(row).toBe(
    '6663058751643,1006,11.99,bogus,,"Test ""Ace"" Buyer","123 Test Street, San Francisco",,2026-11-02T13:05:00Z,"Line\nbreak",',
  );
});

it("BE-5 CSV export : 1. writes one row per line item and repeats the order columns", () => {
  const rows = lines(
    buildOrdersCsv([
      order({
        lineItems: [
          lineItem({ product: { title: "First", tags: "[]" } }),
          lineItem({ product: { title: "Second", tags: "[]" } }),
        ],
      }),
    ]),
  ).slice(1);

  const orderColumns = (row: string) => row.split(",").slice(0, 9);
  expect(rows).toHaveLength(2);
  expect(orderColumns(rows[1])).toEqual(orderColumns(rows[0]));
  expect(rows[0].split(",")[9]).toBe("First");
  expect(rows[1].split(",")[9]).toBe("Second");
});

it("BE-5 CSV export : 1. writes one row with empty product columns for an order without line items", () => {
  const rows = lines(buildOrdersCsv([order({ lineItems: [] })])).slice(1);

  expect(rows).toHaveLength(1);
  expect(rows[0].split(",")[0]).toBe("6663058751643");
  expect(rows[0].split(",").slice(9)).toEqual(["", ""]);
});

it.each(["=", "+", "-", "@", "\t"])(
  "BE-5 CSV export : 1. prefixes a text cell starting with =, +, -, @, tab or carriage return with an apostrophe (%j)",
  (start) => {
    const value = `${start}1`;
    const cells = firstRow(
      order({
        paymentGateways: JSON.stringify([value]),
        customerEmail: value,
        customerFullName: value,
        customerAddress: value,
        tags: JSON.stringify([value]),
        lineItems: [
          lineItem({
            product: { title: value, tags: JSON.stringify([value]) },
          }),
        ],
      }),
    ).split(",");

    const written = Array(5).fill(`'${value}`);
    expect(cells.slice(3, 8)).toEqual(written);
    expect(cells.slice(9)).toEqual(written.slice(0, 2));
  },
);

it("BE-5 CSV export : 1. prefixes a text cell starting with a carriage return, and quotes it", () => {
  expect(firstRow(order({ tags: '["\\r1"]' }))).toContain(`,"'\r1",`);
});

it("BE-5 CSV export : 1. prefixes the title at purchase used as the Product title", () => {
  expect(
    cell(
      order({ lineItems: [lineItem({ title: "=1", product: null })] }),
      "Product title",
    ),
  ).toBe("'=1");
});

it("BE-5 CSV export : 1. quotes a prefixed value that also needs escaping", () => {
  const row = firstRow(order({ tags: JSON.stringify(["=a", 'b"c']) }));

  expect(row).toContain(`,"'=a, b""c",`);
});

it("BE-5 CSV export : 1. does not prefix a value with those characters only later in the cell", () => {
  expect(cell(order({ tags: '["a=b"]' }), "Tags")).toBe("a=b");
});

it("BE-5 CSV export : 1. leaves numeric and generated columns without the prefix", () => {
  expect(cell(order({ totalPriceMinor: -1199n }), "Total price")).toBe(
    "-11.99",
  );
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
    expect(cell(order({ totalPriceMinor, currencyCode }), "Total price")).toBe(
      expected,
    );
  },
);

it("BE-5 CSV export : 5. outputs Payment gateway", () => {
  expect(cell(order(), "Payment gateway")).toBe("bogus");
});

it("BE-5 CSV export : 5. joins multiple payment gateways with the separator", () => {
  expect(firstRow(order({ paymentGateways: '["bogus","manual"]' }))).toContain(
    ',"bogus, manual",',
  );
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

it("BE-5 CSV export : 11. outputs Product title", () => {
  expect(cell(order(), "Product title")).toBe("Product title");
});

it("BE-5 CSV export : 11. falls back to the title at purchase without a product", () => {
  expect(
    cell(order({ lineItems: [lineItem({ product: null })] }), "Product title"),
  ).toBe("Title at purchase");
});

it("BE-5 CSV export : 12. outputs Product tags", () => {
  expect(cell(order(), "Product tags")).toBe("Winter");
  expect(
    firstRow(
      order({
        lineItems: [
          lineItem({ product: { title: "P", tags: '["Winter","Sport"]' } }),
        ],
      }),
    ).endsWith(',"Winter, Sport"'),
  ).toBe(true);
});

it("BE-5 CSV export : 12. leaves Product tags empty without a product", () => {
  expect(
    cell(order({ lineItems: [lineItem({ product: null })] }), "Product tags"),
  ).toBe("");
});
