import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/webhooks.orders";
import {
  fixtureOrder,
  fixtures,
  orderWithLineItems,
} from "../helpers/order-fixtures";
import {
  mockAdminGraphql,
  resetAdminGraphql,
  THROTTLED,
} from "../helpers/admin-graphql";
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
    customerRedacted: false,
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

it.each([
  ["the GraphQL response has errors", THROTTLED, 500],
  [
    "the Admin API responds 503",
    () => new Response(null, { status: 503 }),
    503,
  ],
])(
  "BE-1 Webhook ingestion : 1. does not return 2xx when %s, so Shopify retries",
  async (_failure, adminResponse, expectedStatus) => {
    const requests = mockAdminGraphql(SHOP, adminResponse);

    // What the delivery gets back: React Router answers with a thrown Response as it
    // is, and with 500 for anything else thrown.
    const status = await orders(orderWebhook("orders/create", ORDER_ID)).then(
      (response) => response.status,
      (thrown: unknown) => (thrown instanceof Response ? thrown.status : 500),
    );

    // The exact status, because any error thrown after the fetch is also non-2xx: if
    // the empty 503 reached `response.json()`, the parse error would give 500.
    expect(status).toBe(expectedStatus);
    // The failure is the fetch, not something that stopped the route before it.
    expect(requests).toHaveLength(1);
    expect(await db.order.count()).toBe(0);
  },
);

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
      shopifyUpdatedAt: new Date("2026-11-01T05:17:32Z"),
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

it("BE-6 Fields not in order JSON : 1. stores product title and tags for a signed orders/create webhook", async () => {
  // #1001 after one of its products was renamed and retagged, and the other deleted.
  mockAdminGraphql(SHOP, fixtures.productChanged);

  const response = await orders(
    orderWebhook("orders/create", "gid://shopify/Order/6661012521115"),
  );

  expect(response.status).toBe(200);
  expect(await db.product.findMany()).toEqual([
    {
      id: "gid://shopify/Product/9478544261275",
      shop: SHOP,
      title: "The Collection Snowboard: Hydrogen Changed",
      tags: JSON.stringify(["Accessory", "Snowboard", "Sport", "Winter"]),
      shopifyUpdatedAt: new Date("2026-11-01T05:20:01Z"),
    },
  ]);
  expect(
    await db.lineItem.findMany({
      orderBy: { id: "asc" },
      select: { productId: true, title: true },
    }),
  ).toEqual([
    // The line item keeps the title at purchase.
    {
      productId: "gid://shopify/Product/9478544261275",
      title: "The Collection Snowboard: Hydrogen",
    },
    // The deleted product comes back as product: null.
    { productId: null, title: "The Collection Snowboard: Liquid" },
  ]);
});

it("BE-1 Webhook ingestion : 1. stores every order when several signed orders/create webhooks arrive at the same time", async () => {
  // A burst of new orders (#77). Each one is the regular fixture with its own order
  // and line item IDs. They share the fixture's two products.
  const ORDER_COUNT = 10;
  const orderIds = Array.from(
    { length: ORDER_COUNT },
    (_, index) => `gid://shopify/Order/${1000 + index}`,
  );
  const regular = fixtureOrder(fixtures.regular);
  mockAdminGraphql(SHOP, ({ id }) => ({
    ...fixtures.regular,
    data: {
      order: {
        ...regular,
        id,
        lineItems: {
          nodes: regular.lineItems.nodes.map((lineItem, index) => ({
            ...lineItem,
            id: `gid://shopify/LineItem/${Number(String(id).split("/").pop()) * 100 + index}`,
          })),
        },
      },
    },
  }));

  const responses = await Promise.all(
    orderIds.map((orderId) => orders(orderWebhook("orders/create", orderId))),
  );

  expect(responses.map((response) => response.status)).toEqual(
    orderIds.map(() => 200),
  );
  expect(
    (
      await db.order.findMany({ select: { id: true }, orderBy: { id: "asc" } })
    ).map((order) => order.id),
  ).toEqual([...orderIds].sort());
  expect(await db.lineItem.count()).toBe(ORDER_COUNT * 2);
  expect(await db.product.count()).toBe(2);
});

it.each([51, 250])(
  "BE-1 Webhook ingestion : 1. stores all %i line items of an order for a signed orders/create webhook",
  async (count) => {
    const order = orderWithLineItems(fixtures.regular, count);
    // Only as many line items as the query asks for, as Shopify would answer.
    mockAdminGraphql(SHOP, (_variables, query) => {
      const first = /lineItems\(first: (\d+)/.exec(query)?.[1];
      if (!first) throw new Error("The query does not page its line items");
      const nodes = order.lineItems.nodes.slice(0, Number(first));
      return { data: { order: { ...order, lineItems: { nodes } } } };
    });

    const response = await orders(orderWebhook("orders/create", ORDER_ID));

    expect(response.status).toBe(200);
    expect(await db.lineItem.count({ where: { orderId: ORDER_ID } })).toBe(
      count,
    );
    expect(await db.product.count({ where: { shop: SHOP } })).toBe(count);
  },
);

it("BE-1 Webhook ingestion : 1. stores an order with a total of 0 for a signed orders/create webhook", async () => {
  const order = fixtureOrder(fixtures.regular);
  mockAdminGraphql(SHOP, {
    data: {
      order: {
        ...order,
        currentTotalPriceSet: {
          shopMoney: { ...order.currentTotalPriceSet.shopMoney, amount: "0.0" },
        },
      },
    },
  });

  const response = await orders(orderWebhook("orders/create", ORDER_ID));

  expect(response.status).toBe(200);
  const stored = await db.order.findUniqueOrThrow({ where: { id: ORDER_ID } });
  expect(stored.totalPriceMinor).toBe(0n);
});

it("BE-1 Webhook ingestion : 2. a full refund updates the stored order to a total of 0 and no quantity", async () => {
  const refunded = fixtureOrder(fixtures.refunded);
  // The order as stored before the refund: a paid order, updated earlier.
  mockAdminGraphql(SHOP, {
    data: { order: { ...fixtureOrder(fixtures.regular), id: refunded.id } },
  });
  await orders(orderWebhook("orders/create", refunded.id));
  mockAdminGraphql(SHOP, fixtures.refunded);

  const response = await orders(orderWebhook("orders/updated", refunded.id));

  expect(response.status).toBe(200);
  const stored = await db.order.findUniqueOrThrow({
    where: { id: refunded.id },
    include: { lineItems: true },
  });
  expect(stored.totalPriceMinor).toBe(0n);
  expect(stored.paymentGateways).toBe(JSON.stringify(["bogus"]));
  expect(stored.lineItems.map((lineItem) => lineItem.quantity)).toEqual([0]);
});
