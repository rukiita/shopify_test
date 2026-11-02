import db from "../../db.server";
import type { MappedOrder } from "../domain/order-mapper";
import { shouldOverwrite } from "../domain/should-overwrite";

// The customer fields of a redacted order (customers/redact).
const REDACTED = {
  customerEmail: null,
  customerFullName: null,
  customerAddress: null,
};

// Writes one ingested order. Primary keys are Shopify GIDs, so writing the same
// order again updates the same rows instead of adding new ones.
//
// The order and its line items are written unless the fetched updatedAt is older
// than the stored one, so a fetch that finishes late cannot overwrite newer data.
// Each product is checked the same way, by the product's own updatedAt.
//
// Returns whether the order was written.
export async function saveOrder({ order, lineItems, products }: MappedOrder) {
  return db.$transaction(async (tx) => {
    // app/uninstalled deletes the shop's data and sessions in one transaction
    // (deleteShopData). Checking the session in this transaction keeps a fetch that
    // was in flight during the uninstall from writing the data back.
    const sessions = await tx.session.count({ where: { shop: order.shop } });
    if (sessions === 0) {
      return false;
    }

    // Line items point to products, so products are written first. Each product
    // has its own updatedAt check: two orders with the same product can be
    // ingested at once, and the older fetch may finish last.
    // One read for all of them: an order can have up to 250 line items.
    const storedProducts = new Map(
      (
        await tx.product.findMany({
          where: { id: { in: products.map((product) => product.id) } },
          select: { id: true, shopifyUpdatedAt: true },
        })
      ).map((stored) => [stored.id, stored.shopifyUpdatedAt]),
    );
    for (const product of products) {
      const storedUpdatedAt = storedProducts.get(product.id) ?? null;
      if (!shouldOverwrite(storedUpdatedAt, product.shopifyUpdatedAt)) {
        continue;
      }
      if (storedUpdatedAt) {
        await tx.product.update({ where: { id: product.id }, data: product });
      } else {
        await tx.product.create({ data: product });
      }
    }

    const stored = await tx.order.findUnique({
      where: { id: order.id },
      select: { shopifyUpdatedAt: true, customerRedacted: true },
    });
    if (
      !shouldOverwrite(stored?.shopifyUpdatedAt ?? null, order.shopifyUpdatedAt)
    ) {
      return false;
    }

    if (stored) {
      await tx.order.update({
        where: { id: order.id },
        // A redacted order keeps its customer fields empty, whatever the fetch
        // returned (customers/redact).
        data: stored.customerRedacted ? { ...order, ...REDACTED } : order,
      });
    } else {
      await tx.order.create({ data: order });
    }
    // Replaced as a set, so a line item removed from the order is removed here.
    await tx.lineItem.deleteMany({ where: { orderId: order.id } });
    await tx.lineItem.createMany({ data: lineItems });
    return true;
  });
}

// The stored shopifyUpdatedAt of the given orders of a shop, by order ID. Orders
// not stored here are missing from the map.
export async function findStoredUpdatedAt(shop: string, orderIds: string[]) {
  const stored = await db.order.findMany({
    where: { shop, id: { in: orderIds } },
    select: { id: true, shopifyUpdatedAt: true },
  });
  return new Map(stored.map((order) => [order.id, order.shopifyUpdatedAt]));
}

const ORDER_LIST_PAGE_SIZE = 50;

interface ListOrdersOptions {
  after?: string;
  before?: string;
  pageSize?: number;
}

// One page of a shop's orders, newest first, with the columns the order list shows.
// The page starts after the order with the ID `after`, or ends before the order with
// the ID `before`.
export async function listOrders(
  shop: string,
  { after, before, pageSize = ORDER_LIST_PAGE_SIZE }: ListOrdersOptions = {},
) {
  // The cursor comes from the URL. Prisma would compare the shop's orders with any
  // order it names, and return nothing for one that is gone, so anything but one of
  // the shop's own orders gives the first page.
  const requested = after ?? before;
  const cursor = requested
    ? (
        await db.order.findFirst({
          where: { id: requested, shop },
          select: { id: true },
        })
      )?.id
    : undefined;

  const page = await readOrderPage(shop, pageSize, cursor, !after);
  // A saved URL of the last page, once nothing is past its cursor. The first page, so
  // the list does not look empty for a shop that has orders.
  return cursor && page.orders.length === 0
    ? readOrderPage(shop, pageSize)
    : page;
}

async function readOrderPage(
  shop: string,
  pageSize: number,
  cursor?: string,
  beforeCursor = false,
) {
  const backwards = Boolean(cursor) && beforeCursor;

  const orders = await db.order.findMany({
    where: { shop },
    // By ID too, because the created time is not unique. Orders created in the same
    // second get a defined order, and Prisma pages in SQL: with an orderBy that is not
    // unique it reads every order up to the cursor and pages in memory.
    orderBy: [{ shopifyCreatedAt: "desc" }, { id: "desc" }],
    // One more than the page, to tell whether there is another page in that
    // direction. A negative take reads backwards and keeps the order.
    take: backwards ? -(pageSize + 1) : pageSize + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      shopifyCreatedAt: true,
      customerFullName: true,
      customerEmail: true,
      totalPriceMinor: true,
      currencyCode: true,
      paymentGateways: true,
      tags: true,
    },
  });

  const hasMore = orders.length > pageSize;
  return {
    orders: backwards ? orders.slice(-pageSize) : orders.slice(0, pageSize),
    // The cursor's order itself is on the side the page was read away from.
    hasNextPage: backwards ? true : hasMore,
    hasPreviousPage: backwards ? hasMore : Boolean(cursor),
  };
}

// Removes the customer's email, name and address from the given orders of a shop
// (customers/redact), and marks the orders so that a later ingestion does not
// write them back. The order, its line items and tags stay. Orders not stored
// here are skipped.
export async function redactCustomer(shop: string, orderIds: string[]) {
  await db.order.updateMany({
    where: { shop, id: { in: orderIds } },
    data: { ...REDACTED, customerRedacted: true },
  });
}

// Deletes every order, line item, product and session of a shop (app/uninstalled,
// and shop/redact 48 hours later).
// One transaction. Writes run one at a time over one connection (#77), so an
// ingestion that overlaps it either commits first (and is deleted here) or runs
// after it and finds no session. One that cannot start within Prisma's transaction
// wait fails and is retried by Shopify.
export async function deleteShopData(shop: string) {
  await db.$transaction([
    // Line items go with their orders (onDelete: Cascade).
    db.order.deleteMany({ where: { shop } }),
    db.product.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
}
