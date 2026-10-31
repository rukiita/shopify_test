import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { resetDatabase } from "../helpers/database";

const SHOP = "test-shop.myshopify.com";
const ORDER_ID = "gid://shopify/Order/1001";
const PRODUCT_ID = "gid://shopify/Product/2001";

beforeEach(resetDatabase);

const createProduct = () =>
  db.product.create({
    data: {
      id: PRODUCT_ID,
      shop: SHOP,
      title: "Test Product",
      tags: JSON.stringify(["summer", "sale"]),
    },
  });

const orderData = {
  id: ORDER_ID,
  shop: SHOP,
  name: "#1001",
  number: 1,
  totalPriceMinor: 1199,
  currencyCode: "USD",
  paymentGateways: JSON.stringify(["bogus"]),
  customerEmail: "test.buyer@example.com",
  customerFullName: "Test Buyer",
  customerAddress: "1 Test Street, Ottawa ON K1A 0A1, Canada",
  tags: JSON.stringify(["VIP", "wholesale"]),
  shopifyCreatedAt: new Date("2026-10-31T01:00:00Z"),
  shopifyUpdatedAt: new Date("2026-10-31T02:00:00Z"),
};

it("BE-7 Whole app : 3. an Order with its LineItems and Products is written and read back", async () => {
  await createProduct();
  await db.order.create({
    data: {
      ...orderData,
      lineItems: {
        create: [
          {
            id: "gid://shopify/LineItem/3001",
            productId: PRODUCT_ID,
            title: "Test Product (at purchase)",
            quantity: 2,
          },
        ],
      },
    },
  });

  const order = await db.order.findUniqueOrThrow({
    where: { id: ORDER_ID },
    include: { lineItems: { include: { product: true } } },
  });

  expect(order).toMatchObject(orderData);
  expect(JSON.parse(order.tags)).toEqual(["VIP", "wholesale"]);
  expect(order.lineItems).toEqual([
    {
      id: "gid://shopify/LineItem/3001",
      orderId: ORDER_ID,
      productId: PRODUCT_ID,
      title: "Test Product (at purchase)",
      quantity: 2,
      product: {
        id: PRODUCT_ID,
        shop: SHOP,
        title: "Test Product",
        tags: JSON.stringify(["summer", "sale"]),
      },
    },
  ]);
});

it("BE-7 Whole app : 3. a LineItem without a Product is stored", async () => {
  await db.order.create({
    data: {
      ...orderData,
      lineItems: {
        create: [
          {
            id: "gid://shopify/LineItem/3002",
            productId: null,
            title: "Custom item",
            quantity: 1,
          },
        ],
      },
    },
  });

  const lineItem = await db.lineItem.findUniqueOrThrow({
    where: { id: "gid://shopify/LineItem/3002" },
    include: { product: true },
  });

  expect(lineItem.productId).toBeNull();
  expect(lineItem.product).toBeNull();
  expect(lineItem.title).toBe("Custom item");
});

it("BE-7 Whole app : 3. deleting an Order deletes its LineItems", async () => {
  await createProduct();
  await db.order.create({
    data: {
      ...orderData,
      lineItems: {
        create: [
          {
            id: "gid://shopify/LineItem/3001",
            productId: PRODUCT_ID,
            title: "Test Product",
            quantity: 1,
          },
        ],
      },
    },
  });

  await db.order.delete({ where: { id: ORDER_ID } });

  expect(await db.lineItem.count()).toBe(0);
  expect(await db.product.count()).toBe(1);
});

it("BE-7 Whole app : 3. deleting a Product keeps its LineItems without a product", async () => {
  await createProduct();
  await db.order.create({
    data: {
      ...orderData,
      lineItems: {
        create: [
          {
            id: "gid://shopify/LineItem/3001",
            productId: PRODUCT_ID,
            title: "Test Product",
            quantity: 1,
          },
        ],
      },
    },
  });

  await db.product.delete({ where: { id: PRODUCT_ID } });

  const lineItem = await db.lineItem.findUniqueOrThrow({
    where: { id: "gid://shopify/LineItem/3001" },
  });
  expect(lineItem.productId).toBeNull();
});
