import type { LoaderFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { loader } from "../../app/routes/app._index";
import { resetDatabase } from "../helpers/database";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";
import { adminRequest, sessionToken } from "../helpers/session-token";

const SHOP = "test-shop.myshopify.com";
const OTHER_SHOP = "other-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
  await createOfflineSession(OTHER_SHOP);
});

const load = (request: Request) =>
  loader({ request, params: {}, context: {} } as LoaderFunctionArgs);

it("BE-2 Order list : 1. the loader returns the shop's orders newest first", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.noCustomer)));
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.productNull)));

  const result = await load(adminRequest("/app", sessionToken(SHOP), "GET"));

  expect(result).toEqual({
    orders: [
      {
        id: "gid://shopify/Order/6663058751643",
        name: "#1006",
        createdAt: "2026-11-01T05:17:27.000Z",
        customerName: "Test Buyer",
        customerEmail: "test.buyer+1@example.com",
        total: "$1,385.95",
        paymentGateways: ["bogus"],
        tags: ["Snowboard"],
      },
      {
        id: "gid://shopify/Order/6662857195675",
        name: "#1002",
        createdAt: "2026-11-01T03:18:30.000Z",
        customerName: null,
        customerEmail: null,
        total: "$24.95",
        paymentGateways: ["manual"],
        tags: [],
      },
    ],
    hasNextPage: false,
    hasPreviousPage: false,
  });
});

it("BE-2 Order list : 1. the loader rejects a request without a valid session token", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));

  const thrown = await load(
    adminRequest("/app", sessionToken(SHOP, "not-the-app-secret"), "GET"),
  ).catch((failure: unknown) => failure);

  expect((thrown as Response).status).toBe(401);
});

it("BE-2 Order list : 1. the loader reads the page from the cursor in the URL", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.noCustomer)));
  const newer = fixtureOrder(fixtures.regular).id;
  const older = fixtureOrder(fixtures.noCustomer).id;
  const list = async (query: string) => {
    const result = await load(
      adminRequest(`/app?${query}`, sessionToken(SHOP), "GET"),
    );
    return result?.orders.map((order) => order.name);
  };

  expect(await list(`after=${encodeURIComponent(newer)}`)).toEqual(["#1002"]);
  expect(await list(`before=${encodeURIComponent(older)}`)).toEqual(["#1006"]);
});
