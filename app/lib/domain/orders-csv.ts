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
  const rows = [HEADER, ...orders.map(toRow)];
  return BOM + rows.map((row) => `${row.map(escapeCell).join(",")}\r\n`).join("");
}

function toRow(order: StoredExportOrder) {
  return [
    // gid://shopify/Order/6663058751643 -> 6663058751643
    order.id.slice(order.id.lastIndexOf("/") + 1),
    String(order.number),
    formatDecimal(order.totalPriceMinor, order.currencyCode),
    joinList(order.paymentGateways),
    order.customerEmail ?? "",
    order.customerFullName ?? "",
    order.customerAddress ?? "",
    joinList(order.tags),
    // Seconds are the precision Shopify has, so no milliseconds.
    order.shopifyCreatedAt.toISOString().replace(/\.\d{3}Z$/, "Z"),
    "",
    "",
  ];
}

// A JSON array of strings, as stored, in one cell.
const joinList = (stored: string) => (JSON.parse(stored) as string[]).join(", ");

const escapeCell = (value: string) =>
  value.includes(",") ? `"${value}"` : value;
