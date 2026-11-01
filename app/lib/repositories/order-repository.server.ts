import db from "../../db.server";
import type { MappedOrder } from "../domain/order-mapper";
import { shouldOverwrite } from "../domain/should-overwrite";

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
    for (const product of products) {
      const storedProduct = await tx.product.findUnique({
        where: { id: product.id },
        select: { shopifyUpdatedAt: true },
      });
      if (
        !shouldOverwrite(
          storedProduct?.shopifyUpdatedAt ?? null,
          product.shopifyUpdatedAt,
        )
      ) {
        continue;
      }
      if (storedProduct) {
        await tx.product.update({ where: { id: product.id }, data: product });
      } else {
        await tx.product.create({ data: product });
      }
    }

    const stored = await tx.order.findUnique({
      where: { id: order.id },
      select: { shopifyUpdatedAt: true },
    });
    if (
      !shouldOverwrite(stored?.shopifyUpdatedAt ?? null, order.shopifyUpdatedAt)
    ) {
      return;
    }

    if (stored) {
      await tx.order.update({ where: { id: order.id }, data: order });
    } else {
      await tx.order.create({ data: order });
    }
    // Replaced as a set, so a line item removed from the order is removed here.
    await tx.lineItem.deleteMany({ where: { orderId: order.id } });
    await tx.lineItem.createMany({ data: lineItems });
  });
}

// Deletes every order, line item, product and session of a shop (app/uninstalled).
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
