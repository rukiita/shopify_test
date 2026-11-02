import { beforeEach, expect, it } from "vitest";
import db from "../../app/db.server";
import { listOrders } from "../../app/lib/repositories/order-repository.server";
import { resetDatabase } from "../helpers/database";

const SHOP = "test-shop.myshopify.com";

beforeEach(resetDatabase);

// An order numbered `number`, created `number` minutes into the hour unless
// `createdAt` is given, so a higher number is newer.
const createOrder = (
  number: number,
  { shop = SHOP, createdAt = minutes(number) } = {},
) =>
  db.order.create({
    data: {
      id: orderId(number),
      shop,
      name: `#${number}`,
      number,
      totalPriceMinor: 100n,
      currencyCode: "USD",
      paymentGateways: "[]",
      tags: "[]",
      shopifyCreatedAt: createdAt,
      shopifyUpdatedAt: createdAt,
    },
  });

const orderId = (number: number) => `gid://shopify/Order/${number}`;
const minutes = (minute: number) => new Date(Date.UTC(2026, 10, 1, 0, minute));
const names = (page: Awaited<ReturnType<typeof listOrders>>) =>
  page.orders.map((order) => order.name);

it("BE-2 Order list : 1. returns orders newest first", async () => {
  await createOrder(1);
  await createOrder(3);
  await createOrder(2);

  const page = await listOrders(SHOP);

  expect(names(page)).toEqual(["#3", "#2", "#1"]);
  expect(page.hasNextPage).toBe(false);
  expect(page.hasPreviousPage).toBe(false);
});

it("BE-2 Order list : 1. returns the next page from a cursor", async () => {
  for (const number of [1, 2, 3, 4, 5]) {
    await createOrder(number);
  }

  const first = await listOrders(SHOP, { pageSize: 2 });
  expect(names(first)).toEqual(["#5", "#4"]);
  expect(first.hasNextPage).toBe(true);
  expect(first.hasPreviousPage).toBe(false);

  const middle = await listOrders(SHOP, { pageSize: 2, after: orderId(4) });
  expect(names(middle)).toEqual(["#3", "#2"]);
  expect(middle.hasNextPage).toBe(true);
  expect(middle.hasPreviousPage).toBe(true);

  const last = await listOrders(SHOP, { pageSize: 2, after: orderId(2) });
  expect(names(last)).toEqual(["#1"]);
  expect(last.hasNextPage).toBe(false);
  expect(last.hasPreviousPage).toBe(true);
});

it("BE-2 Order list : 1. excludes orders from other shops", async () => {
  await createOrder(1);
  await createOrder(2, { shop: "other-shop.myshopify.com" });
  await createOrder(3);

  const page = await listOrders(SHOP);

  expect(names(page)).toEqual(["#3", "#1"]);
});

it("BE-2 Order list : 1. returns the previous page from a cursor", async () => {
  for (const number of [1, 2, 3, 4, 5]) {
    await createOrder(number);
  }

  const middle = await listOrders(SHOP, { pageSize: 2, before: orderId(2) });
  expect(names(middle)).toEqual(["#4", "#3"]);
  expect(middle.hasNextPage).toBe(true);
  expect(middle.hasPreviousPage).toBe(true);

  const first = await listOrders(SHOP, { pageSize: 2, before: orderId(3) });
  expect(names(first)).toEqual(["#5", "#4"]);
  expect(first.hasNextPage).toBe(true);
  expect(first.hasPreviousPage).toBe(false);
});

it("BE-2 Order list : 1. keeps every order across pages when orders share a created time", async () => {
  // Added out of ID order, so that the order they were added in does not pass.
  for (const number of [3, 1, 5, 2, 4]) {
    await createOrder(number, { createdAt: minutes(0) });
  }
  const pageOf = async (cursor: { after?: string; before?: string }) =>
    names(await listOrders(SHOP, { pageSize: 2, ...cursor }));

  expect(await pageOf({})).toEqual(["#5", "#4"]);
  expect(await pageOf({ after: orderId(4) })).toEqual(["#3", "#2"]);
  expect(await pageOf({ after: orderId(2) })).toEqual(["#1"]);
  expect(await pageOf({ before: orderId(2) })).toEqual(["#4", "#3"]);
});
