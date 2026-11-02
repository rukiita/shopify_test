import type { Prisma } from "@prisma/client";
import { formatDecimal } from "./money";

// The columns the CSV export reads from the database.
export const ORDER_EXPORT_COLUMNS = {
  id: true,
  number: true,
  totalPriceMinor: true,
  currencyCode: true,
  paymentGateways: true,
  customerEmail: true,
  customerFullName: true,
  customerAddress: true,
  tags: true,
  shopifyCreatedAt: true,
  lineItems: {
    orderBy: { id: "asc" },
    select: {
      title: true,
      quantity: true,
      product: { select: { title: true, tags: true } },
    },
  },
} satisfies Prisma.OrderSelect;

export type StoredExportOrder = Prisma.OrderGetPayload<{
  select: typeof ORDER_EXPORT_COLUMNS;
}>;

// The CSV template, followed by the product columns.
const HEADER = [
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

// Without the BOM, Excel does not read the file as UTF-8.
const BOM = "\uFEFF";

export function buildOrdersCsv(orders: StoredExportOrder[]) {
  const rows = [HEADER, ...orders.flatMap(toRows)];
  return (
    BOM + rows.map((row) => `${row.map(escapeCell).join(",")}\r\n`).join("")
  );
}

// One row per line item, repeating the order's columns. A line item with quantity 0 was
// removed by an order edit or refunded, so it is not part of the order as it is now. An
// order with no line items left still gets a row, so that it does not go missing from
// the file.
function toRows(order: StoredExportOrder) {
  const orderColumns = [
    // gid://shopify/Order/6663058751643 -> 6663058751643
    order.id.slice(order.id.lastIndexOf("/") + 1),
    String(order.number),
    formatDecimal(order.totalPriceMinor, order.currencyCode),
    textCell(joinList(order.paymentGateways)),
    textCell(order.customerEmail ?? ""),
    textCell(order.customerFullName ?? ""),
    textCell(order.customerAddress ?? ""),
    textCell(joinList(order.tags)),
    // Seconds are the precision Shopify has, so no milliseconds.
    order.shopifyCreatedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
  ];
  const lineItems = order.lineItems.filter(({ quantity }) => quantity > 0);
  if (lineItems.length === 0) {
    return [[...orderColumns, "", ""]];
  }
  return lineItems.map(({ title, product }) => [
    ...orderColumns,
    textCell(product?.title ?? title),
    textCell(product ? joinList(product.tags) : ""),
  ]);
}

// A JSON array of strings, as stored, in one cell.
const joinList = (stored: string) =>
  (JSON.parse(stored) as string[]).join(", ");

// The characters that start a formula, from the OWASP page on CSV injection, including
// the full-width ＝＋－＠.
const FORMULA_CHARACTERS = "=+\\-@\\t\\uFF1D\\uFF0B\\uFF0D\\uFF20";
const FORMULA_START = new RegExp(`^[${FORMULA_CHARACTERS}\\r\\n]`);
// Where ; is the spreadsheet's separator, commas do not split a line, so a value's
// opening quote is in the middle of a cell and does not protect it: the value is cut at
// each ; and line break. A quote can come first, because it starts a quoted cell there.
const FORMULA_AFTER_SEPARATOR = new RegExp(
  `[;\\r\\n]+(?="*[${FORMULA_CHARACTERS}])`,
  "g",
);

// Free text can contain something a spreadsheet would run as a formula, and quoting does
// not stop it at the start of a cell, so an apostrophe goes in front of it. Numeric and
// generated columns do not go through this, so that a negative total stays a number.
const textCell = (value: string) => {
  const text = value.replace(FORMULA_AFTER_SEPARATOR, "$&'");
  return FORMULA_START.test(text) ? `'${text}` : text;
};

// RFC 4180. A semicolon is quoted too, for a reader that accepts both , and ; as
// separators and honours the quote. It does not protect a file cut only at ; (see above).
const escapeCell = (value: string) =>
  /[",;\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
