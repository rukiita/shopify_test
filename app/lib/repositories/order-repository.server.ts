import db from "../../db.server";
import type { MappedOrder } from "../domain/order-mapper";

// Writes one ingested order. Primary keys are Shopify GIDs, so writing the same
// order again updates the same rows instead of adding new ones.
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
