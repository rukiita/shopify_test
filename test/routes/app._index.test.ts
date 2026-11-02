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
