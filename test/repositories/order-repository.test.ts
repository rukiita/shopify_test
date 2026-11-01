import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { mapOrder, type MappedOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";

const SHOP = "test-shop.myshopify.com";
const ORDER_ID = "gid://shopify/Order/6663058751643";

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
      shopifyUpdatedAt: new Date("2026-11-01T05:17:30Z"),
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
  // A late fetch whose order is older than the stored one, so the order is not
  // written, but whose product was renamed and retagged since. Products are
  // checked on their own updatedAt, not the order's.
  const resynced = current();
  resynced.order = stale().order;
  resynced.products[0] = {
    ...resynced.products[0],
    title: "Compare at Price Snowboard",
    tags: JSON.stringify(["Sale"]),
    shopifyUpdatedAt: new Date("2026-11-01T06:00:00Z"),
  };

  await saveOrder(resynced);

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544359579" },
    }),
  ).toMatchObject({
    title: "Compare at Price Snowboard",
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

it("BE-6 Fields not in order JSON : 2. stores product tags on the Product", async () => {
  // The product was retagged after the order was placed.
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.productChanged)));

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544261275" },
      select: { tags: true },
    }),
  ).toEqual({
    tags: JSON.stringify(["Accessory", "Snowboard", "Sport", "Winter"]),
  });
});

it("BE-6 Fields not in order JSON : 2. keeps the stored product when the fetched product is older", async () => {
  await saveOrder(current());
  // Another order with the same product, fetched before the product was renamed
  // and retagged, but written last.
  const older = current();
  older.products = older.products.map((product) =>
    product.id === "gid://shopify/Product/9478544261275"
      ? {
          ...product,
          title: "The Collection Snowboard: Hydrogen",
          tags: JSON.stringify(["Accessory", "Sport", "Winter"]),
          shopifyUpdatedAt: new Date("2026-11-01T05:17:32Z"),
        }
      : product,
  );

  await saveOrder(older);

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544261275" },
    }),
  ).toMatchObject({
    title: "The Collection Snowboard: Hydrogen Changed",
    tags: JSON.stringify(["Accessory", "Snowboard", "Sport", "Winter"]),
    shopifyUpdatedAt: new Date("2026-11-01T05:20:01Z"),
  });
});

it("BE-6 Fields not in order JSON : 2. overwrites the stored product when the fetched product has the same updatedAt", async () => {
  await saveOrder(current());
  // updatedAt has one-second precision, so a later change made in the same second
  // carries the same value.
  const sameSecond = current();
  sameSecond.products[0] = {
    ...sameSecond.products[0],
    tags: JSON.stringify(["Sale"]),
  };

  await saveOrder(sameSecond);

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544359579" },
      select: { tags: true },
    }),
  ).toEqual({ tags: JSON.stringify(["Sale"]) });
});

it("BE-6 Fields not in order JSON : 2. overwrites a product stored before its updatedAt was recorded", async () => {
  // The migration that added shopifyUpdatedAt gave existing rows 1970-01-01.
  await db.product.create({
    data: {
      id: "gid://shopify/Product/9478544359579",
      shop: SHOP,
      title: "Old title",
      tags: JSON.stringify([]),
      shopifyUpdatedAt: new Date(0),
    },
  });

  await saveOrder(current());

  expect(
    await db.product.findUniqueOrThrow({
      where: { id: "gid://shopify/Product/9478544359579" },
    }),
  ).toMatchObject({
    title: "The Compare at Price Snowboard",
    tags: JSON.stringify(["Accessory", "Sport", "Winter"]),
    shopifyUpdatedAt: new Date("2026-11-01T05:17:32Z"),
  });
});
