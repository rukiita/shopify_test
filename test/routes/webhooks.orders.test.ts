import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/webhooks.orders";
import { fixtures } from "../helpers/order-fixtures";
import { mockAdminGraphql, resetAdminGraphql } from "../helpers/admin-graphql";
import { resetDatabase } from "../helpers/database";
import { createOfflineSession } from "../helpers/session";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";
const ORDER_ID = "gid://shopify/Order/6663058751643";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

afterEach(resetAdminGraphql);

const orders = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

// Only the field the route reads from the payload (ADR-0003). Real payloads carry
// the whole order in REST format.
const orderWebhook = (topic: string, orderId: string) =>
  signedWebhookRequest({
    path: "/webhooks/orders",
    topic,
    shop: SHOP,
    body: { admin_graphql_api_id: orderId },
  });

it("BE-1 Webhook ingestion : 1. stores the order and line items for a signed orders/create webhook", async () => {
  const requests = mockAdminGraphql(SHOP, fixtures.regular);

  const response = await orders(orderWebhook("orders/create", ORDER_ID));

  expect(response.status).toBe(200);
  expect(requests.map((request) => request.variables)).toEqual([
    { id: ORDER_ID },
  ]);
  const order = await db.order.findUniqueOrThrow({
    where: { id: ORDER_ID },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });
  expect(order).toEqual({
    id: ORDER_ID,
    shop: SHOP,
    name: "#1006",
    number: 1006,
    totalPriceMinor: 138595n,
    currencyCode: "USD",
    paymentGateways: JSON.stringify(["bogus"]),
    customerEmail: "test.buyer+1@example.com",
    customerFullName: "Test Buyer",
    customerAddress:
      "123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",
    tags: JSON.stringify(["Snowboard"]),
    shopifyCreatedAt: new Date("2026-11-01T05:17:27Z"),
    shopifyUpdatedAt: new Date("2026-11-01T05:24:39Z"),
    lineItems: [
      {
        id: "gid://shopify/LineItem/15129586073755",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544359579",
        title: "The Compare at Price Snowboard",
        quantity: 1,
      },
      {
        id: "gid://shopify/LineItem/15129586106523",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544261275",
        title: "The Collection Snowboard: Hydrogen",
        quantity: 1,
      },
    ],
  });
});

it("BE-1 Webhook ingestion : 1. returns 200 and stores nothing when the refetched order no longer exists", async () => {
  const DELETED_ORDER_ID = "gid://shopify/Order/6662861226139";
  const requests = mockAdminGraphql(SHOP, fixtures.deleted);

  const response = await orders(
    orderWebhook("orders/create", DELETED_ORDER_ID),
  );

  expect(response.status).toBe(200);
  expect(requests).toHaveLength(1);
  expect(await db.order.count()).toBe(0);
});

it("BE-1 Webhook ingestion : 1. returns 401 for an invalid signature", async () => {
  const requests = mockAdminGraphql(SHOP, fixtures.regular);

  const response = await orders(
    signedWebhookRequest({
      path: "/webhooks/orders",
      topic: "orders/create",
      shop: SHOP,
      body: { admin_graphql_api_id: ORDER_ID },
      secret: "not-the-app-secret",
    }),
  ).catch((thrown: unknown) => thrown);

  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(401);
  expect(requests).toHaveLength(0);
  expect(await db.order.count()).toBe(0);
});

it("BE-1 Webhook ingestion : 1. returns 200 and stores nothing when the shop has no session", async () => {
  // A delivery that arrives after app/uninstalled deleted the session.
  await db.session.deleteMany();
  const requests = mockAdminGraphql(SHOP, fixtures.regular);

  const response = await orders(orderWebhook("orders/create", ORDER_ID));

  expect(response.status).toBe(200);
  expect(requests).toHaveLength(0);
  expect(await db.order.count()).toBe(0);
});

it("BE-1 Webhook ingestion : 1. does not duplicate when the same webhook arrives twice", async () => {
  mockAdminGraphql(SHOP, fixtures.regular);

  for (let delivery = 0; delivery < 2; delivery++) {
    const response = await orders(orderWebhook("orders/create", ORDER_ID));
    expect(response.status).toBe(200);
  }

  expect(await db.order.count()).toBe(1);
  expect(await db.lineItem.count()).toBe(2);
  expect(await db.product.count()).toBe(2);
});

it("BE-1 Webhook ingestion : 2. updates the stored order for a signed orders/updated webhook", async () => {
  // The order as stored before a staff edit: no tags, another address, and a line
  // item the edit removed.
  await db.product.create({
    data: {
      id: "gid://shopify/Product/9478544261275",
      shop: SHOP,
      title: "The Collection Snowboard: Hydrogen",
      tags: JSON.stringify([]),
    },
  });
  await db.order.create({
    data: {
      id: ORDER_ID,
      shop: SHOP,
      name: "#1006",
      number: 1006,
      totalPriceMinor: 138595n,
      currencyCode: "USD",
      paymentGateways: JSON.stringify(["bogus"]),
      customerEmail: "test.buyer+1@example.com",
      customerFullName: "Test Buyer",
      customerAddress: "1 Old Street, San Francisco CA 94103, United States",
      tags: JSON.stringify([]),
      shopifyCreatedAt: new Date("2026-11-01T05:17:27Z"),
      shopifyUpdatedAt: new Date("2026-11-01T05:17:30Z"),
      lineItems: {
        create: [
          {
            id: "gid://shopify/LineItem/15129586106523",
            productId: "gid://shopify/Product/9478544261275",
            title: "The Collection Snowboard: Hydrogen",
            quantity: 1,
          },
          {
            id: "gid://shopify/LineItem/1",
            productId: null,
            title: "Removed item",
            quantity: 1,
          },
        ],
      },
    },
  });
  mockAdminGraphql(SHOP, fixtures.regular);

  const response = await orders(orderWebhook("orders/updated", ORDER_ID));

  expect(response.status).toBe(200);
  const order = await db.order.findUniqueOrThrow({
    where: { id: ORDER_ID },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });
  expect(order).toMatchObject({
    tags: JSON.stringify(["Snowboard"]),
    customerAddress:
      "123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",
    shopifyUpdatedAt: new Date("2026-11-01T05:24:39Z"),
  });
  expect(order.lineItems.map((lineItem) => lineItem.id)).toEqual([
    "gid://shopify/LineItem/15129586073755",
    "gid://shopify/LineItem/15129586106523",
  ]);
});
