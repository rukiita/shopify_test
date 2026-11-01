import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/webhooks.orders";
import regularOrder from "../fixtures/order-regular.json";
import { mockAdminGraphql, resetAdminGraphql } from "../helpers/admin-graphql";
import { resetDatabase } from "../helpers/database";
import { createOfflineSession } from "../helpers/session";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";
const ORDER_ID = "gid://shopify/Order/6661012521115";

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
  const requests = mockAdminGraphql(SHOP, regularOrder);

  const response = await orders(orderWebhook("orders/create", ORDER_ID));

  expect(response.status).toBe(200);
  expect(requests.map((request) => request.variables)).toEqual([{ id: ORDER_ID }]);
  const order = await db.order.findUniqueOrThrow({
    where: { id: ORDER_ID },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });
  expect(order).toEqual({
    id: ORDER_ID,
    shop: SHOP,
    name: "#1001",
    number: 1001,
    totalPriceMinor: 134995n,
    currencyCode: "USD",
    paymentGateways: JSON.stringify(["bogus"]),
    customerEmail: "test.buyer+1@example.com",
    customerFullName: "Test Buyer",
    customerAddress:
      "123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",
    tags: JSON.stringify(["Snowboard"]),
    shopifyCreatedAt: new Date("2026-10-31T06:33:06Z"),
    shopifyUpdatedAt: new Date("2026-11-01T03:25:55Z"),
    lineItems: [
      {
        id: "gid://shopify/LineItem/15126054502555",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544261275",
        title: "The Collection Snowboard: Hydrogen",
        quantity: 1,
      },
      {
        id: "gid://shopify/LineItem/15126054535323",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544523419",
        title: "The Collection Snowboard: Liquid",
        quantity: 1,
      },
    ],
  });
});
