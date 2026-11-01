import type { ActionFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { action } from "../../app/routes/webhooks.customers.redact";
import redactPayload from "../fixtures/compliance-customers-redact.json";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";
// In the payload's orders_to_redact.
const LISTED_ORDER_ID = "gid://shopify/Order/6663058751643";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

const redact = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

const storedOrder = (id: string) =>
  db.order.findUniqueOrThrow({
    where: { id },
    include: { lineItems: { orderBy: { id: "asc" } } },
  });

it("BE-7 Whole app : 1. customers/redact removes the customer's email, name and address from the listed orders", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  const before = await storedOrder(LISTED_ORDER_ID);

  const response = await redact(
    signedWebhookRequest({
      path: "/webhooks/customers/redact",
      topic: "customers/redact",
      shop: SHOP,
      body: redactPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await storedOrder(LISTED_ORDER_ID)).toEqual({
    ...before,
    customerEmail: null,
    customerFullName: null,
    customerAddress: null,
  });
});

it("BE-7 Whole app : 1. customers/redact returns 401 for an invalid signature and changes nothing", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  const before = await storedOrder(LISTED_ORDER_ID);

  const response = await redact(
    signedWebhookRequest({
      path: "/webhooks/customers/redact",
      topic: "customers/redact",
      shop: SHOP,
      body: redactPayload,
      secret: "not-the-app-secret",
    }),
  ).catch((thrown: unknown) => thrown);

  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(401);
  expect(await storedOrder(LISTED_ORDER_ID)).toEqual(before);
});

it("BE-7 Whole app : 1. customers/redact redacts even when the shop has no session", async () => {
  // Redaction can be requested after the app was uninstalled, when the sessions
  // are gone but shop/redact has not deleted the data yet.
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  await db.session.deleteMany();

  const response = await redact(
    signedWebhookRequest({
      path: "/webhooks/customers/redact",
      topic: "customers/redact",
      shop: SHOP,
      body: redactPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await storedOrder(LISTED_ORDER_ID)).toMatchObject({
    customerEmail: null,
    customerFullName: null,
    customerAddress: null,
  });
});

it("BE-7 Whole app : 1. customers/redact returns 200 and changes nothing when orders_to_redact is missing", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  const before = await storedOrder(LISTED_ORDER_ID);
  const withoutOrders: Partial<typeof redactPayload> = { ...redactPayload };
  delete withoutOrders.orders_to_redact;

  const response = await redact(
    signedWebhookRequest({
      path: "/webhooks/customers/redact",
      topic: "customers/redact",
      shop: SHOP,
      body: withoutOrders,
    }),
  );

  expect(response.status).toBe(200);
  expect(await storedOrder(LISTED_ORDER_ID)).toEqual(before);
});

it("BE-7 Whole app : 1. customers/redact returns 401 and changes nothing when the payload is for another shop", async () => {
  // A body signed for test-shop, resent with another shop in the unsigned
  // X-Shopify-Shop-Domain header.
  const OTHER_SHOP = "other-shop.myshopify.com";
  await createOfflineSession(OTHER_SHOP);
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.regular)));
  const before = await storedOrder(LISTED_ORDER_ID);

  const response = await redact(
    signedWebhookRequest({
      path: "/webhooks/customers/redact",
      topic: "customers/redact",
      shop: OTHER_SHOP,
      body: redactPayload,
    }),
  );

  expect(response.status).toBe(401);
  expect(await storedOrder(LISTED_ORDER_ID)).toEqual(before);
});
