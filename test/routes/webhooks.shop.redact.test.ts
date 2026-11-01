import type { ActionFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { action } from "../../app/routes/webhooks.shop.redact";
import shopRedactPayload from "../fixtures/compliance-shop-redact.json";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";
const OTHER_SHOP = "other-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

const shopRedact = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

it("BE-7 Whole app : 1. shop/redact deletes the shop's orders, line items, products and sessions", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  // Another shop's order, with other products.
  await createOfflineSession(OTHER_SHOP);
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.noCustomer)));

  const response = await shopRedact(
    signedWebhookRequest({
      path: "/webhooks/shop/redact",
      topic: "shop/redact",
      shop: SHOP,
      body: shopRedactPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await db.order.findMany({ select: { shop: true } })).toEqual([
    { shop: OTHER_SHOP },
  ]);
  expect(await db.lineItem.count()).toBe(1);
  expect(await db.product.findMany({ select: { shop: true } })).toEqual([
    { shop: OTHER_SHOP },
  ]);
  expect(await db.session.findMany({ select: { shop: true } })).toEqual([
    { shop: OTHER_SHOP },
  ]);
});

it("BE-7 Whole app : 1. shop/redact returns 401 for an invalid signature and keeps the data", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));

  const response = await shopRedact(
    signedWebhookRequest({
      path: "/webhooks/shop/redact",
      topic: "shop/redact",
      shop: SHOP,
      body: shopRedactPayload,
      secret: "not-the-app-secret",
    }),
  ).catch((thrown: unknown) => thrown);

  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(401);
  expect(await db.order.count()).toBe(1);
  expect(await db.product.count()).toBe(2);
  expect(await db.session.count()).toBe(1);
});

it("BE-7 Whole app : 1. shop/redact returns 401 and keeps the data when the payload is for another shop", async () => {
  // A body signed for test-shop, resent with another shop in the unsigned
  // X-Shopify-Shop-Domain header.
  await createOfflineSession(OTHER_SHOP);
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.regular)));
  await db.session.deleteMany({ where: { shop: OTHER_SHOP } });

  const response = await shopRedact(
    signedWebhookRequest({
      path: "/webhooks/shop/redact",
      topic: "shop/redact",
      shop: OTHER_SHOP,
      body: shopRedactPayload,
    }),
  );

  expect(response.status).toBe(401);
  expect(await db.order.count({ where: { shop: OTHER_SHOP } })).toBe(1);
  expect(await db.product.count({ where: { shop: OTHER_SHOP } })).toBe(2);
});
