import type { ActionFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { action } from "../../app/routes/webhooks.customers.data_request";
import dataRequestPayload from "../fixtures/compliance-customers-data-request.json";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

const dataRequest = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

const storedOrders = () => db.order.findMany({ include: { lineItems: true } });

it("BE-7 Whole app : 1. customers/data_request returns 200 and changes nothing", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  const before = await storedOrders();

  const response = await dataRequest(
    signedWebhookRequest({
      path: "/webhooks/customers/data_request",
      topic: "customers/data_request",
      shop: SHOP,
      body: dataRequestPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await storedOrders()).toEqual(before);
});
