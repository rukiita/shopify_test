import type { Order } from "@prisma/client";
import { formatMoney } from "./money";

// The columns the order list reads from the database.
export type StoredOrderListRow = Pick<
  Order,
  | "id"
  | "name"
  | "shopifyCreatedAt"
  | "customerFullName"
  | "customerEmail"
  | "totalPriceMinor"
  | "currencyCode"
  | "paymentGateways"
  | "tags"
>;

// One row of the order list. Plain data, so a loader can return it: `totalPriceMinor`
// is a bigint, which JSON.stringify throws on.
export interface OrderListRow {
  id: string;
  name: string;
  createdAt: string;
  customerName: string | null;
  customerEmail: string | null;
  total: string;
  paymentGateways: string[];
  tags: string[];
}

export function toOrderListRow(order: StoredOrderListRow): OrderListRow {
  return {
    id: order.id,
    name: order.name,
    createdAt: order.shopifyCreatedAt.toISOString(),
    customerName: order.customerFullName,
    customerEmail: order.customerEmail,
    total: formatMoney(order.totalPriceMinor, order.currencyCode),
    paymentGateways: JSON.parse(order.paymentGateways),
    tags: JSON.parse(order.tags),
  };
}

export function formatOrderDate(createdAt: string, timeZone: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(createdAt));
}
