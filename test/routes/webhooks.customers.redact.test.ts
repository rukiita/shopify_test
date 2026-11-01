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
