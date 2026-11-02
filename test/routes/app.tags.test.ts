import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/app.tags";
import tagsAdded from "../fixtures/tags-add.json";
import { mockAdminGraphql, resetAdminGraphql } from "../helpers/admin-graphql";
import { resetDatabase } from "../helpers/database";
import { createOfflineSession } from "../helpers/session";
import { adminRequest, sessionToken } from "../helpers/session-token";

const SHOP = "test-shop.myshopify.com";
// The order in the captured responses to the tag mutations.
const ORDER_ID = "gid://shopify/Order/6665501474971";
// Before the captured responses' updatedAt.
const STORED_UPDATED_AT = new Date("2026-11-02T06:12:36Z");

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
});

afterEach(resetAdminGraphql);

const createOrder = ({ shop = SHOP, tags = ["wholesale"] } = {}) =>
  db.order.create({
    data: {
      id: ORDER_ID,
      shop,
      name: "#1045",
      number: 1045,
      totalPriceMinor: 100n,
      currencyCode: "USD",
      paymentGateways: "[]",
      tags: JSON.stringify(tags),
      shopifyCreatedAt: STORED_UPDATED_AT,
      shopifyUpdatedAt: STORED_UPDATED_AT,
    },
  });

const storedOrder = () => db.order.findUniqueOrThrow({ where: { id: ORDER_ID } });

const addTag = (tag: string) =>
  action({
    request: adminRequest(
      "/app/tags",
      sessionToken(SHOP),
      "POST",
      new URLSearchParams({ intent: "add", orderId: ORDER_ID, tag }),
    ),
    params: {},
    context: {},
  } as ActionFunctionArgs);

it("BE-3 Add tag : 1. calls tagsAdd and updates the stored tags", async () => {
  await createOrder();
  const requests = mockAdminGraphql(SHOP, tagsAdded);

  const result = await addTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(requests).toHaveLength(1);
  expect(requests[0].query).toContain("tagsAdd(");
  expect(requests[0].variables).toEqual({ id: ORDER_ID, tags: ["VIP"] });
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP", "wholesale"]);
});
