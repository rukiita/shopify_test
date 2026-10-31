import type { ActionFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/webhooks.app.uninstalled";
import { resetDatabase } from "../helpers/database";
import { signedWebhookRequest } from "../helpers/webhook";

const SHOP = "test-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await db.session.create({
    data: {
      id: `offline_${SHOP}`,
      shop: SHOP,
      state: "",
      isOnline: false,
      accessToken: "test-access-token",
    },
  });
});

const uninstalled = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

it("BE-7 Whole app : 1. a signed app/uninstalled webhook deletes the shop's sessions", async () => {
  const response = await uninstalled(
    signedWebhookRequest({
      path: "/webhooks/app/uninstalled",
      topic: "app/uninstalled",
      shop: SHOP,
      body: {},
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
      body: {},
      secret: "not-the-app-secret",
    }),
  ).catch((thrown: unknown) => thrown);

  expect(response).toBeInstanceOf(Response);
  expect((response as Response).status).toBe(401);
  expect(await db.session.count({ where: { shop: SHOP } })).toBe(1);
});
