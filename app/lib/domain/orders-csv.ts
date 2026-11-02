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

// One row per line item, repeating the order's columns. An order without line items
// still gets a row, so that it does not go missing from the file.
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
  if (order.lineItems.length === 0) {
    return [[...orderColumns, "", ""]];
  }
  return order.lineItems.map(({ title, product }) => [
    ...orderColumns,
    textCell(product?.title ?? title),
    textCell(product ? joinList(product.tags) : ""),
  ]);
}

// A JSON array of strings, as stored, in one cell.
const joinList = (stored: string) =>
  (JSON.parse(stored) as string[]).join(", ");

// Free text can start with something a spreadsheet would run as a formula, and quoting
// does not stop it, so the cell gets a leading apostrophe. Numeric and generated
// columns do not go through this, so that a negative total stays a number.
const textCell = (value: string) =>
  /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;

// RFC 4180.
const escapeCell = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
