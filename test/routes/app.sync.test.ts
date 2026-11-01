import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/app.sync";
import {
  fixtureOrder,
  fixtures,
  orderIdPages,
  type OrderQueryResponse,
} from "../helpers/order-fixtures";
import { mockAdminGraphql, resetAdminGraphql } from "../helpers/admin-graphql";
import { resetDatabase } from "../helpers/database";
import { createOfflineSession } from "../helpers/session";
import { adminRequest, sessionToken } from "../helpers/session-token";

const SHOP = "test-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

afterEach(resetAdminGraphql);

const sync = (request: Request) =>
  action({ request, params: {}, context: {} } as ActionFunctionArgs);

const syncRequest = () => adminRequest("/app/sync", SHOP, sessionToken(SHOP));

// The orders listed in orderIdPages, by ID.
const ordersById: Record<string, OrderQueryResponse> = Object.fromEntries(
  [fixtures.productChanged, fixtures.noCustomer, fixtures.productNull].map(
    (fixture) => [fixtureOrder(fixture).id, fixture],
  ),
);

// Answers the page query with the next captured page, and the order query with the
// fixture of the requested order (or `orders[id]` when given).
function mockStore(orders: Record<string, OrderQueryResponse> = ordersById) {
  return mockAdminGraphql(SHOP, (variables) => {
    if (typeof variables.id === "string") {
      return orders[variables.id];
    }
    const after = variables.after;
    return after
      ? orderIdPages.find(
          (_, index) =>
            orderIdPages[index - 1]?.data.orders.pageInfo.endCursor === after,
        )
      : orderIdPages[0];
  });
}

it("BE-1 Webhook ingestion : 3. a sync stores every order the orders query lists and returns the count", async () => {
  mockStore();

  const result = await sync(syncRequest());

  expect(result).toEqual({ synced: 3 });
  const stored = await db.order.findMany({
    select: { id: true, shop: true },
    orderBy: { id: "asc" },
  });
  expect(stored).toEqual(
    Object.keys(ordersById)
      .sort()
      .map((id) => ({ id, shop: SHOP })),
  );
});

it("BE-1 Webhook ingestion : 3. a sync requests the next page with the end cursor until there is no next page", async () => {
  const requests = mockStore();

  await sync(syncRequest());

  const pageRequests = requests.filter(
    (request) => !("id" in (request.variables ?? {})),
  );
  expect(pageRequests.map((request) => request.variables ?? {})).toEqual([
    {},
    { after: orderIdPages[0].data.orders.pageInfo.endCursor },
  ]);
});
