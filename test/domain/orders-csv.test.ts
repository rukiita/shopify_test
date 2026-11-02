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

  expect(csv.startsWith("﻿Order id,")).toBe(true);
  expect(csv.endsWith("\r\n")).toBe(true);
  expect(csv.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
});

