import db from "../../db.server";
import type { MappedOrder } from "../domain/order-mapper";
import { shouldOverwrite } from "../domain/should-overwrite";

// Writes one ingested order. Primary keys are Shopify GIDs, so writing the same
// order again updates the same rows instead of adding new ones.
//
// The order and its line items are written only if the fetched updatedAt is newer
// than the stored one, so a fetch that finishes late cannot overwrite newer data.
export async function saveOrder({ order, lineItems, products }: MappedOrder) {
  await db.$transaction(async (tx) => {
    // Line items point to products, so products are written first.
    for (const product of products) {
      await tx.product.upsert({
        where: { id: product.id },
        create: product,
        update: product,
      });
    }

    const stored = await tx.order.findUnique({
      where: { id: order.id },
      select: { shopifyUpdatedAt: true },
    });
    if (!shouldOverwrite(stored?.shopifyUpdatedAt ?? null, order.shopifyUpdatedAt)) {
      return;
    }

    await tx.order.upsert({
      where: { id: order.id },
      create: order,
      update: order,
    });
    // Replaced as a set, so a line item removed from the order is removed here.
    await tx.lineItem.deleteMany({ where: { orderId: order.id } });
    await tx.lineItem.createMany({ data: lineItems });
  });
}

// Deletes every order, line item and product of a shop (app/uninstalled).
export async function deleteShopData(shop: string) {
  await db.$transaction([
    // Line items go with their orders (onDelete: Cascade).
    db.order.deleteMany({ where: { shop } }),
    db.product.deleteMany({ where: { shop } }),
  ]);
}
