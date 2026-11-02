import type { Prisma } from "@prisma/client";
import { formatMoney } from "./money";

// The columns the order list reads from the database. They decide which customer data
// can reach the browser, so `customerAddress` is left out.
export const ORDER_LIST_COLUMNS = {
  id: true,
  name: true,
  shopifyCreatedAt: true,
  customerFullName: true,
  customerEmail: true,
  totalPriceMinor: true,
  currencyCode: true,
  paymentGateways: true,
  tags: true,
} satisfies Prisma.OrderSelect;

export type StoredOrderListRow = Prisma.OrderGetPayload<{
  select: typeof ORDER_LIST_COLUMNS;
}>;

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
  return orderDateFormat(timeZone).format(new Date(createdAt));
}

// Kept per time zone: a page formats every row, on each render.
const orderDateFormats = new Map<string, Intl.DateTimeFormat>();

function orderDateFormat(timeZone: string) {
  let format = orderDateFormats.get(timeZone);
  if (!format) {
    format = createOrderDateFormat(timeZone);
    orderDateFormats.set(timeZone, format);
  }
  return format;
}

function createOrderDateFormat(timeZone: string) {
  const options = { dateStyle: "medium", timeStyle: "short" } as const;
  try {
    return new Intl.DateTimeFormat("en", { ...options, timeZone });
  } catch (error) {
    // The browser reports its own zone, and may not know it ("Etc/Unknown"). One bad
    // value should not take down the whole list.
    if (error instanceof RangeError) {
      return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" });
    }
    throw error;
  }
}
