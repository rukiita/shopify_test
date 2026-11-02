import type { Prisma } from "@prisma/client";

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
const BOM = "﻿";

export function buildOrdersCsv(_orders: StoredExportOrder[]) {
  return `${BOM}${HEADER.join(",")}\r\n`;
}
