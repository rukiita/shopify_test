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
export async function saveOrder({ order, lineItems, products }: MappedOrder) {
  await db.$transaction(async (tx) => {
    // app/uninstalled deletes the shop's data and sessions in one transaction
    // (deleteShopData). Checking the session in this transaction keeps a fetch that
    // was in flight during the uninstall from writing the data back.
    const sessions = await tx.session.count({ where: { shop: order.shop } });
    if (sessions === 0) {
      return;
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
      return;
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
  });
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
// One transaction, so an ingestion that overlaps it either commits first (and is
// deleted here), finds no session, or fails on the database lock and is retried.
export async function deleteShopData(shop: string) {
  await db.$transaction([
    // Line items go with their orders (onDelete: Cascade).
    db.order.deleteMany({ where: { shop } }),
    db.product.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
}
