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
