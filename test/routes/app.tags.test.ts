import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/app.tags";
import { action as ordersWebhookAction } from "../../app/routes/webhooks.orders";
import tagsAddInvalid from "../fixtures/tags-add-invalid.json";
import tagsAddMissingOrder from "../fixtures/tags-add-missing-order.json";
import tagsAdded from "../fixtures/tags-add.json";
import tagsRemoveMissingOrder from "../fixtures/tags-remove-missing-order.json";
import tagsRemoved from "../fixtures/tags-remove.json";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";
import { mockAdminGraphql, resetAdminGraphql } from "../helpers/admin-graphql";
import { resetDatabase } from "../helpers/database";
import { createOfflineSession } from "../helpers/session";
import { adminRequest, sessionToken } from "../helpers/session-token";
import { signedWebhookRequest } from "../helpers/webhook";

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

const storedOrder = () =>
  db.order.findUniqueOrThrow({ where: { id: ORDER_ID } });

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

const removeTag = (tag: string) =>
  action({
    request: adminRequest(
      "/app/tags",
      sessionToken(SHOP),
      "POST",
      new URLSearchParams({ intent: "remove", orderId: ORDER_ID, tag }),
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

it("BE-3 Add tag : 1. stores the tags and updatedAt that Shopify returns", async () => {
  // The stored copy is behind Shopify: "wholesale" was added in the admin.
  await createOrder({ tags: [] });
  mockAdminGraphql(SHOP, tagsAdded);

  await addTag("VIP");

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["VIP", "wholesale"]);
  expect(stored.shopifyUpdatedAt).toEqual(
    new Date(tagsAdded.data.tagsAdd.node.updatedAt),
  );
});

it("BE-3 Add tag : 1. does not overwrite stored tags that are newer than the response", async () => {
  await createOrder();
  // An orders/updated for a later change is stored while tagsAdd is on its way back.
  const newer = new Date("2026-11-02T08:00:00Z");
  mockAdminGraphql(SHOP, async () => {
    await db.order.update({
      where: { id: ORDER_ID },
      data: { tags: '["newer"]', shopifyUpdatedAt: newer },
    });
    return tagsAdded;
  });

  await addTag("VIP");

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["newer"]);
  expect(stored.shopifyUpdatedAt).toEqual(newer);
});

it("BE-3 Add tag : 1. a request whose access token Shopify rejects throws the 401 that makes App Bridge retry", async () => {
  await createOrder();
  mockAdminGraphql(
    SHOP,
    () =>
      new Response(
        JSON.stringify({ errors: "Invalid API key or access token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
  );

  const thrown = await addTag("VIP").catch((error: unknown) => error);

  expect(thrown).toBeInstanceOf(Response);
  expect((thrown as Response).status).toBe(401);
});

it("BE-3 Add tag : 1. rejects an order of another shop without calling Shopify", async () => {
  await createOrder({ shop: "other-shop.myshopify.com" });
  const requests = mockAdminGraphql(SHOP, tagsAdded);

  const result = await addTag("VIP");

  expect(result).toEqual({ error: "This order could not be found" });
  expect(requests).toHaveLength(0);
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-3 Add tag : 1. rejects a tag the order already has without calling Shopify", async () => {
  await createOrder({ tags: ["VIP"] });
  const requests = mockAdminGraphql(SHOP, tagsAdded);

  const result = await addTag("vip");

  expect(result).toEqual({ error: "This order already has that tag" });
  expect(requests).toHaveLength(0);
});

it("BE-3 Add tag : 1. a request without a session token changes nothing", async () => {
  await createOrder();
  const requests = mockAdminGraphql(SHOP, tagsAdded);

  const response = await action({
    request: adminRequest(
      "/app/tags",
      undefined,
      "POST",
      new URLSearchParams({ intent: "add", orderId: ORDER_ID, tag: "VIP" }),
    ),
    params: {},
    context: {},
  } as ActionFunctionArgs).catch((thrown: unknown) => thrown);

  // authenticate.admin treats it as a page load and throws a response that loads
  // App Bridge to get a token, instead of running the action.
  expect(response).toBeInstanceOf(Response);
  expect(requests).toHaveLength(0);
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-3 Add tag : 1. returns an error and leaves the database unchanged on userErrors", async () => {
  await createOrder();
  mockAdminGraphql(SHOP, tagsAddInvalid);

  const result = await addTag("VIP");

  expect(result).toEqual({ error: "Order tags is invalid" });
  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["wholesale"]);
  expect(stored.shopifyUpdatedAt).toEqual(STORED_UPDATED_AT);
});

it("BE-3 Add tag : 1. returns an error when the order no longer exists in Shopify", async () => {
  await createOrder();
  mockAdminGraphql(SHOP, tagsAddMissingOrder);

  const result = await addTag("VIP");

  expect(result).toEqual({ error: "Order does not exist" });
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-3 Add tag : 1. returns an error and leaves the database unchanged when the request fails", async () => {
  await createOrder();
  // The error Shopify returns, with HTTP 200, when a query exceeds the rate limit
  // (https://shopify.dev/docs/api/usage/response-codes). Not captured: written from
  // the documented code.
  mockAdminGraphql(SHOP, {
    errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
  });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await addTag("VIP");

  expect(result).toEqual({ error: "The tag could not be saved. Try again." });
  expect(logged).toHaveBeenCalledOnce();
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
  logged.mockRestore();
});

it("BE-3 Add tag : 1. rejects a request that is missing a field", async () => {
  await createOrder();
  const requests = mockAdminGraphql(SHOP, tagsAdded);

  const result = await action({
    request: adminRequest(
      "/app/tags",
      sessionToken(SHOP),
      "POST",
      new URLSearchParams({ intent: "add", orderId: ORDER_ID }),
    ),
    params: {},
    context: {},
  } as ActionFunctionArgs);

  expect(result).toEqual({ error: "The tag could not be saved. Try again." });
  expect(requests).toHaveLength(0);
});

it("BE-4 Remove tag : 1. calls tagsRemove and updates the stored tags", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  const requests = mockAdminGraphql(SHOP, tagsRemoved);

  const result = await removeTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(requests).toHaveLength(1);
  expect(requests[0].query).toContain("tagsRemove(");
  expect(requests[0].variables).toEqual({ id: ORDER_ID, tags: ["VIP"] });
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-4 Remove tag : 1. returns an error and keeps the tag on userErrors", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  mockAdminGraphql(SHOP, tagsRemoveMissingOrder);

  const result = await removeTag("VIP");

  expect(result).toEqual({ error: "Order does not exist" });
  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["VIP", "wholesale"]);
  expect(stored.shopifyUpdatedAt).toEqual(STORED_UPDATED_AT);
});

it("BE-4 Remove tag : 1. returns an error and keeps the tag when the request fails", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  // The documented rate limit error, as in the add test above. Not captured.
  mockAdminGraphql(SHOP, {
    errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
  });
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await removeTag("VIP");

  expect(result).toEqual({ error: "The tag could not be removed. Try again." });
  expect(logged).toHaveBeenCalledOnce();
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP", "wholesale"]);
  logged.mockRestore();
});

it("BE-4 Remove tag : 1. a request whose access token Shopify rejects throws the 401 that makes App Bridge retry", async () => {
  await createOrder({ tags: ["VIP"] });
  mockAdminGraphql(
    SHOP,
    () =>
      new Response(
        JSON.stringify({ errors: "Invalid API key or access token" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
  );

  const thrown = await removeTag("VIP").catch((error: unknown) => error);

  expect(thrown).toBeInstanceOf(Response);
  expect((thrown as Response).status).toBe(401);
});

it("BE-4 Remove tag : 1. rejects removing a tag that does not exist", async () => {
  await createOrder({ tags: ["VIP"] });
  const requests = mockAdminGraphql(SHOP, tagsRemoved);
  const error = "This order does not have that tag";

  expect(await removeTag("wholesale")).toEqual({ error });
  // tagsRemove matches case-sensitively, so it would do nothing for this one.
  expect(await removeTag("vip")).toEqual({ error });

  expect(requests).toHaveLength(0);
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP"]);
});

it("BE-4 Remove tag : 1. rejects an order of another shop without calling Shopify", async () => {
  await createOrder({ shop: "other-shop.myshopify.com", tags: ["VIP"] });
  const requests = mockAdminGraphql(SHOP, tagsRemoved);

  const result = await removeTag("VIP");

  expect(result).toEqual({ error: "This order could not be found" });
  expect(requests).toHaveLength(0);
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP"]);
});

it("BE-4 Remove tag : 1. keeps the order's other tags", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  const requests = mockAdminGraphql(SHOP, tagsRemoved);

  await removeTag("VIP");

  expect(requests[0].variables?.tags).toEqual(["VIP"]);
  expect(JSON.parse((await storedOrder()).tags)).toContain("wholesale");
});

// An orders/updated for the order, whose refetch returns `tags` and `updatedAt`.
async function deliverOrdersUpdated(tags: string[], updatedAt: string) {
  const order = {
    ...fixtureOrder(fixtures.regular),
    id: ORDER_ID,
    tags,
    updatedAt,
  };
  mockAdminGraphql(SHOP, { data: { order } });
  await ordersWebhookAction({
    request: signedWebhookRequest({
      path: "/webhooks/orders",
      topic: "orders/updated",
      shop: SHOP,
      body: { admin_graphql_api_id: ORDER_ID },
    }),
    params: {},
    context: {},
  } as ActionFunctionArgs);
}

it("BE-4 Remove tag : 1. a fetch from before the removal does not bring the tag back", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  mockAdminGraphql(SHOP, tagsRemoved);
  await removeTag("VIP");

  // A webhook for an earlier change read the order before the removal, and its write
  // comes last: the tag is still there, with the updatedAt the stored copy had.
  await deliverOrdersUpdated(
    ["VIP", "wholesale"],
    STORED_UPDATED_AT.toISOString(),
  );

  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-4 Remove tag : 1. an orders/updated after the removal does not bring the tag back", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  mockAdminGraphql(SHOP, tagsRemoved);
  await removeTag("VIP");

  // The webhook for the removal itself: the refetch returns the state after it.
  const { tags, updatedAt } = tagsRemoved.data.tagsRemove.node;
  await deliverOrdersUpdated(tags, updatedAt);

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["wholesale"]);
  expect(stored.shopifyUpdatedAt).toEqual(new Date(updatedAt));
});
