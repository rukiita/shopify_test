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
