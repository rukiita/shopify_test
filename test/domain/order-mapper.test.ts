import { expect, it } from "vitest";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";

const SHOP = "test-shop.myshopify.com";

it("BE-1 Webhook ingestion : 1. maps a GraphQL order to database records", () => {
  const ORDER_ID = "gid://shopify/Order/6661012521115";

  const mapped = mapOrder(SHOP, fixtureOrder(fixtures.regular));

  expect(mapped).toEqual({
    order: {
      id: ORDER_ID,
      shop: SHOP,
      name: "#1001",
      number: 1001,
      totalPriceMinor: 134995n,
      currencyCode: "USD",
      paymentGateways: JSON.stringify(["bogus"]),
      customerEmail: "test.buyer+1@example.com",
      customerFullName: "Test Buyer",
      customerAddress:
        "123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",
      tags: JSON.stringify(["Snowboard"]),
      shopifyCreatedAt: new Date("2026-10-31T06:33:06Z"),
      shopifyUpdatedAt: new Date("2026-11-01T03:25:55Z"),
    },
    lineItems: [
      {
        id: "gid://shopify/LineItem/15126054502555",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544261275",
        title: "The Collection Snowboard: Hydrogen",
        quantity: 1,
      },
      {
        id: "gid://shopify/LineItem/15126054535323",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544523419",
        title: "The Collection Snowboard: Liquid",
        quantity: 1,
      },
    ],
    products: [
      {
        id: "gid://shopify/Product/9478544261275",
        shop: SHOP,
        title: "The Collection Snowboard: Hydrogen",
        tags: JSON.stringify(["Accessory", "Sport", "Winter"]),
      },
      {
        id: "gid://shopify/Product/9478544523419",
        shop: SHOP,
        title: "The Collection Snowboard: Liquid",
        tags: JSON.stringify(["Accessory", "Sport", "Winter"]),
      },
    ],
  });
});

it("BE-1 Webhook ingestion : 1. maps an order without a customer", () => {
  const { order } = mapOrder(SHOP, fixtureOrder(fixtures.noCustomer));

  expect(order).toMatchObject({
    id: "gid://shopify/Order/6662857195675",
    customerEmail: null,
    customerFullName: null,
    customerAddress: null,
    totalPriceMinor: 2495n,
  });
});
