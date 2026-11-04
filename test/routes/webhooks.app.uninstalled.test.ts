import type { ActionFunctionArgs } from "react-router";
import { beforeEach, expect, it, vi } from "vitest";
import db from "../../app/db.server";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { action } from "../../app/routes/webhooks.app.uninstalled";
import uninstalledPayload from "../fixtures/app-uninstalled.json";
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

const uninstalled = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

it("BE-7 Whole app : 1. a signed app/uninstalled webhook deletes the shop's sessions", async () => {
  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: uninstalledPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await db.session.count({ where: { shop: SHOP } })).toBe(0);
});

it("BE-7 Whole app : 1. app/uninstalled with an invalid signature returns 401 and keeps the sessions", async () => {
  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: uninstalledPayload,
      secret: "not-the-app-secret",
    }),
  ).catch((thrown: unknown) => thrown);

  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(401);
  expect(await db.session.count({ where: { shop: SHOP } })).toBe(1);
});

it("BE-7 Whole app : 1. app/uninstalled deletes the shop's orders, line items and products", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  // Another shop's order, with other products.
  await createOfflineSession(OTHER_SHOP);
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.noCustomer)));

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: uninstalledPayload,
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
});

it("BE-7 Whole app : 1. a repeated app/uninstalled deletes the shop's data even without sessions", async () => {
  // The sessions are gone but the data is left, e.g. by a delivery handled
  // before the deletes ran in one transaction.
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  await db.session.deleteMany();

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: uninstalledPayload,
    }),
  );

  expect(response.status).toBe(200);
  expect(await db.order.count()).toBe(0);
  expect(await db.product.count()).toBe(0);
});

it("BE-7 Whole app : 1. app/uninstalled returns 401 and keeps the data when the payload is for another shop", async () => {
  // A body signed for test-shop, resent with another shop in the unsigned
  // X-Shopify-Shop-Domain header.
  await createOfflineSession(OTHER_SHOP);
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.regular)));

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: OTHER_SHOP,
      body: uninstalledPayload,
    }),
  );

  expect(response.status).toBe(401);
  expect(await db.session.count({ where: { shop: OTHER_SHOP } })).toBe(1);
  expect(await db.order.count({ where: { shop: OTHER_SHOP } })).toBe(1);
  expect(await db.product.count({ where: { shop: OTHER_SHOP } })).toBe(2);
  expect(await db.lineItem.count()).toBe(2);
});

it("BE-7 Whole app : 1. app/uninstalled returns 401 and keeps the data when the payload names no shop", async () => {
  // Shopify's documented sample has "myshopify_domain": null.
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: { ...uninstalledPayload, myshopify_domain: null },
    }),
  );

  expect(response.status).toBe(401);
  expect(await db.session.count({ where: { shop: SHOP } })).toBe(1);
  expect(await db.order.count({ where: { shop: SHOP } })).toBe(1);
  expect(await db.product.count({ where: { shop: SHOP } })).toBe(2);
  expect(await db.lineItem.count()).toBe(2);
});

it("BE-7 Whole app : 1. app/uninstalled returns 401 and keeps the data when the payload has no shop field", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: {},
    }),
  );

  expect(response.status).toBe(401);
  expect(await db.session.count({ where: { shop: SHOP } })).toBe(1);
  expect(await db.order.count({ where: { shop: SHOP } })).toBe(1);
  expect(await db.product.count({ where: { shop: SHOP } })).toBe(2);
  expect(await db.lineItem.count()).toBe(2);
});

it("BE-7 Whole app : 1. app/uninstalled logs the topic and shop, and nothing from the payload, when it returns 401", async () => {
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: OTHER_SHOP,
      body: uninstalledPayload,
    }),
  );

  expect(response.status).toBe(401);
  expect(logged.mock.calls).toEqual([
    [
      `Rejected app/uninstalled webhook for ${OTHER_SHOP}: the signed payload does not name this shop`,
    ],
  ]);
  logged.mockRestore();
});
