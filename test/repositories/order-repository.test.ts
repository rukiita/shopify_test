import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { mapOrder, type MappedOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";

const SHOP = "test-shop.myshopify.com";
const ORDER_ID = "gid://shopify/Order/6661012521115";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

const current = () => mapOrder(SHOP, fixtureOrder(fixtures.regular));

// The same order as fetched earlier, before a tag was added and the second line
// item existed.
const stale = (): MappedOrder => {
  const { order, lineItems, products } = current();
  return {
    order: {
      ...order,
      tags: JSON.stringify([]),
      shopifyUpdatedAt: new Date("2026-10-31T06:33:08Z"),
    },
    lineItems: lineItems.slice(0, 1),
    products: products.slice(0, 1),
  };
};

const storedOrder = () =>
  db.order.findUniqueOrThrow({
    where: { id: ORDER_ID },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });

it("BE-1 Webhook ingestion : 2. ignores a stale webhook that arrives late", async () => {
  await saveOrder(current());
  const before = await storedOrder();

  await saveOrder(stale());

  expect(await storedOrder()).toEqual(before);
  expect(before.lineItems).toHaveLength(2);
});

it("BE-1 Webhook ingestion : 2. updates the products even when the order is not overwritten", async () => {
  await saveOrder(current());
  // Same order version, but the product was renamed and retagged since.
  const resynced = current();
  resynced.products[0] = {
    ...resynced.products[0],
    title: "Hydrogen Snowboard",
    tags: JSON.stringify(["Sale"]),
  };

  await saveOrder(resynced);

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544261275" },
    }),
  ).toMatchObject({
    title: "Hydrogen Snowboard",
    tags: JSON.stringify(["Sale"]),
  });
});

it("BE-1 Webhook ingestion : 1. stores nothing when the shop was uninstalled during the fetch", async () => {
  // app/uninstalled deleted the shop's data and sessions while the order was
  // being fetched.
  await db.session.deleteMany();

  await saveOrder(current());

  expect(await db.order.count()).toBe(0);
  expect(await db.lineItem.count()).toBe(0);
  expect(await db.product.count()).toBe(0);
});
