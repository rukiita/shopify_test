import type { ActionFunctionArgs } from "react-router";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import db from "../../app/db.server";
import { action } from "../../app/routes/app.tags";
import { action as ordersWebhookAction } from "../../app/routes/webhooks.orders";
import invalidToken from "../fixtures/admin-invalid-token.json";
import tagsAddInvalid from "../fixtures/tags-add-invalid.json";
import tagsAddMissingOrder from "../fixtures/tags-add-missing-order.json";
import tagsAdded from "../fixtures/tags-add.json";
import tagsRemoveOtherCase from "../fixtures/tags-remove-other-case.json";
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

// The response to the refetch after a write: a captured order, with this test's ID,
// tags and updatedAt.
const orderResponse = (tags: string[], updatedAt: string) => ({
  data: {
    order: { ...fixtureOrder(fixtures.regular), id: ORDER_ID, tags, updatedAt },
  },
});

const ADDED = tagsAdded.data.tagsAdd.node;
const orderAfterAdd = orderResponse(ADDED.tags, ADDED.updatedAt);

// Only a tag mutation has `tags` in its variables.
const isTagMutation = (variables: Record<string, unknown>) =>
  "tags" in variables;

const mockStore = (mutation: object, order: object = orderAfterAdd) =>
  mockAdminGraphql(SHOP, (variables) =>
    isTagMutation(variables) ? mutation : order,
  );

const REMOVED = tagsRemoved.data.tagsRemove.node;
const orderAfterRemove = orderResponse(REMOVED.tags, REMOVED.updatedAt);

const rejectedToken = () =>
  new Response(JSON.stringify(invalidToken), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });

// The error Shopify returns, with HTTP 200, when a query exceeds the rate limit
// (https://shopify.dev/docs/api/usage/response-codes). Not captured: the development
// store cannot be made to throttle on demand. Written from the documented code.
const THROTTLED = {
  errors: [{ message: "Throttled", extensions: { code: "THROTTLED" } }],
};

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
  const requests = mockStore(tagsAdded);

  const result = await addTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(requests).toHaveLength(2);
  expect(requests[0].query).toContain("tagsAdd(");
  expect(requests[0].variables).toEqual({ id: ORDER_ID, tags: ["VIP"] });
  expect(requests[1].variables).toEqual({ id: ORDER_ID });
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP", "wholesale"]);
});

it("BE-3 Add tag : 1. stores the whole order as Shopify has it after the write", async () => {
  // The stored copy is behind Shopify: a webhook for an earlier change never succeeded.
  // tagsAdd may have nothing to do, and then no orders/updated follows to repair it.
  await createOrder({ tags: [] });
  mockStore(tagsAdded);

  await addTag("VIP");

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(ADDED.tags);
  expect(stored.shopifyUpdatedAt).toEqual(new Date(ADDED.updatedAt));
  expect(stored.name).toBe(fixtureOrder(fixtures.regular).name);
});

it("BE-3 Add tag : 1. does not overwrite stored tags that are newer than the response", async () => {
  await createOrder();
  // An orders/updated for a later change is stored while the refetch is on its way back.
  const newer = new Date("2026-11-02T08:00:00Z");
  mockAdminGraphql(SHOP, async (variables) => {
    if (isTagMutation(variables)) return tagsAdded;
    await db.order.update({
      where: { id: ORDER_ID },
      data: { tags: '["newer"]', shopifyUpdatedAt: newer },
    });
    return orderAfterAdd;
  });

  await addTag("VIP");

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["newer"]);
  expect(stored.shopifyUpdatedAt).toEqual(newer);
});

it("BE-3 Add tag : 1. a request whose access token Shopify rejects throws the 401 that makes App Bridge retry", async () => {
  await createOrder();
  mockAdminGraphql(SHOP, rejectedToken);

  const thrown = await addTag("VIP").catch((error: unknown) => error);

  expect(thrown).toBeInstanceOf(Response);
  expect((thrown as Response).status).toBe(401);
});

it("BE-3 Add tag : 1. a refetch whose access token Shopify rejects throws the 401 too", async () => {
  await createOrder();
  mockAdminGraphql(SHOP, (variables) =>
    isTagMutation(variables) ? tagsAdded : rejectedToken(),
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

it("BE-3 Add tag : 1. rejects a tag the order already has without calling tagsAdd", async () => {
  await createOrder({ tags: ["VIP"] });
  const requests = mockStore(
    tagsAdded,
    orderResponse(["VIP"], ADDED.updatedAt),
  );

  const result = await addTag("vip");

  expect(result).toEqual({ error: "This order already has that tag" });
  expect(requests.filter((r) => isTagMutation(r.variables ?? {}))).toEqual([]);
});

it("BE-3 Add tag : 1. rejects an empty tag without calling tagsAdd", async () => {
  await createOrder();
  const requests = mockStore(tagsAdded);

  for (const tag of ["", "   "]) {
    expect(await addTag(tag)).toEqual({ error: "Enter a tag" });
  }

  expect(requests).toEqual([]);
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
});

it("BE-3 Add tag : 1. a tag at exactly the maximum length reaches tagsAdd", async () => {
  await createOrder();
  const requests = mockStore(tagsAdded);

  expect(await addTag("x".repeat(55))).toEqual({ ok: true });

  expect(requests[0].query).toContain("tagsAdd(");
  expect(requests[0].variables).toEqual({
    id: ORDER_ID,
    tags: ["x".repeat(55)],
  });
});

it("BE-3 Add tag : 1. rejects a tag over the maximum length without calling tagsAdd", async () => {
  await createOrder();
  const requests = mockStore(tagsAdded);

  expect(await addTag("x".repeat(56))).toEqual({
    error: "A tag can have at most 55 characters",
  });

  expect(requests).toEqual([]);
});

it("BE-3 Add tag : 1. adds a tag that only the stored copy still has", async () => {
  // Removed in the Shopify admin, and the webhook has not arrived.
  await createOrder({ tags: ["VIP"] });
  const orders = [orderResponse([], "2026-11-02T07:00:00Z"), orderAfterAdd];
  const requests = mockAdminGraphql(SHOP, (variables) =>
    isTagMutation(variables) ? tagsAdded : orders.shift(),
  );

  const result = await addTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(requests.filter((r) => isTagMutation(r.variables ?? {}))).toHaveLength(
    1,
  );
  expect(JSON.parse((await storedOrder()).tags)).toEqual(ADDED.tags);
});

it("BE-3 Add tag : 1. returns an error when the stored order cannot be read", async () => {
  await createOrder();
  await db.order.update({
    where: { id: ORDER_ID },
    data: { tags: "not JSON" },
  });
  const requests = mockStore(tagsAdded);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await addTag("VIP");

  expect(result).toEqual({ error: "The tag could not be saved. Try again." });
  expect(logged).toHaveBeenCalledOnce();
  expect(requests).toHaveLength(0);
  logged.mockRestore();
});

it("BE-3 Add tag : 1. reports success when only the refetch after tagsAdd fails", async () => {
  await createOrder();
  // The tag is on the order in Shopify, and the orders/updated for it repairs the copy.
  mockStore(tagsAdded, THROTTLED);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await addTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(logged).toHaveBeenCalledOnce();
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["wholesale"]);
  logged.mockRestore();
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
  mockAdminGraphql(SHOP, THROTTLED);
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
  const requests = mockStore(tagsRemoved, orderAfterRemove);

  const result = await removeTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(requests).toHaveLength(2);
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
  mockAdminGraphql(SHOP, THROTTLED);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await removeTag("VIP");

  expect(result).toEqual({ error: "The tag could not be removed. Try again." });
  expect(logged).toHaveBeenCalledOnce();
  expect(JSON.parse((await storedOrder()).tags)).toEqual(["VIP", "wholesale"]);
  logged.mockRestore();
});

it("BE-4 Remove tag : 1. a request whose access token Shopify rejects throws the 401 that makes App Bridge retry", async () => {
  await createOrder({ tags: ["VIP"] });
  mockAdminGraphql(SHOP, rejectedToken);

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
  const requests = mockStore(tagsRemoved, orderAfterRemove);

  await removeTag("VIP");

  expect(requests[0].variables?.tags).toEqual(["VIP"]);
  expect(JSON.parse((await storedOrder()).tags)).toContain("wholesale");
});

// An orders/updated for the order, whose refetch returns `tags` and `updatedAt`.
async function deliverOrdersUpdated(tags: string[], updatedAt: string) {
  mockAdminGraphql(SHOP, orderResponse(tags, updatedAt));
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
  mockStore(tagsRemoved, orderAfterRemove);
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
  mockStore(tagsRemoved, orderAfterRemove);
  await removeTag("VIP");

  // The webhook for the removal itself: the refetch returns the state after it.
  await deliverOrdersUpdated(REMOVED.tags, REMOVED.updatedAt);

  const stored = await storedOrder();
  expect(JSON.parse(stored.tags)).toEqual(["wholesale"]);
  expect(stored.shopifyUpdatedAt).toEqual(new Date(REMOVED.updatedAt));
});

it("BE-4 Remove tag : 1. returns an error when tagsRemove leaves the tag, as with another case in Shopify", async () => {
  // The case was changed in Shopify, and the webhook has not arrived. tagsRemove finds
  // nothing to remove, and does not say so.
  await createOrder({ tags: ["SPIKE-vip"] });
  const { tags, updatedAt } = tagsRemoveOtherCase.data.tagsRemove.node;
  mockStore(tagsRemoveOtherCase, orderResponse(tags, updatedAt));

  const result = await removeTag("SPIKE-vip");

  expect(result).toEqual({
    error: "This tag has changed in Shopify. Try again.",
  });
  // The stored copy now has the tag as Shopify has it, so trying again removes it.
  expect(JSON.parse((await storedOrder()).tags)).toContain("spike-VIP");
});

it("BE-4 Remove tag : 1. returns an error when the stored order cannot be read", async () => {
  await createOrder();
  await db.order.update({
    where: { id: ORDER_ID },
    data: { tags: "not JSON" },
  });
  const requests = mockStore(tagsRemoved, orderAfterRemove);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await removeTag("VIP");

  expect(result).toEqual({ error: "The tag could not be removed. Try again." });
  expect(logged).toHaveBeenCalledOnce();
  expect(requests).toHaveLength(0);
  logged.mockRestore();
});

it("BE-4 Remove tag : 1. reports success when only the refetch after tagsRemove fails", async () => {
  await createOrder({ tags: ["VIP", "wholesale"] });
  mockStore(tagsRemoved, THROTTLED);
  const logged = vi.spyOn(console, "error").mockImplementation(() => {});

  const result = await removeTag("VIP");

  expect(result).toEqual({ ok: true });
  expect(logged).toHaveBeenCalledOnce();
  logged.mockRestore();
});
