import { expect, it } from "vitest";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { fixtureOrder, fixtures } from "../helpers/order-fixtures";

const SHOP = "test-shop.myshopify.com";

it("BE-1 Webhook ingestion : 1. maps a GraphQL order to database records", () => {
  const ORDER_ID = "gid://shopify/Order/6663058751643";

  const mapped = mapOrder(SHOP, fixtureOrder(fixtures.regular));

  expect(mapped).toEqual({
    order: {
      id: ORDER_ID,
      shop: SHOP,
      name: "#1006",
      number: 1006,
      totalPriceMinor: 138595n,
      currencyCode: "USD",
      paymentGateways: JSON.stringify(["bogus"]),
      customerEmail: "test.buyer+1@example.com",
      customerFullName: "Test Buyer",
      customerAddress:
        "123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",
      tags: JSON.stringify(["Snowboard"]),
      shopifyCreatedAt: new Date("2026-11-01T05:17:27Z"),
      shopifyUpdatedAt: new Date("2026-11-01T05:24:39Z"),
    },
    lineItems: [
      {
        id: "gid://shopify/LineItem/15129586073755",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544359579",
        title: "The Compare at Price Snowboard",
        quantity: 1,
      },
      {
        id: "gid://shopify/LineItem/15129586106523",
        orderId: ORDER_ID,
        productId: "gid://shopify/Product/9478544261275",
        title: "The Collection Snowboard: Hydrogen",
        quantity: 1,
      },
    ],
    products: [
      {
        id: "gid://shopify/Product/9478544359579",
        shop: SHOP,
        title: "The Compare at Price Snowboard",
        tags: JSON.stringify(["Accessory", "Sport", "Winter"]),
      },
      {
        id: "gid://shopify/Product/9478544261275",
        shop: SHOP,
        title: "The Collection Snowboard: Hydrogen Changed",
        tags: JSON.stringify(["Accessory", "Snowboard", "Sport", "Winter"]),
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

it("BE-1 Webhook ingestion : 1. falls back to the billing address when there is no shipping address", () => {
  // The captured order with its shipping address removed and another billing
  // address, so the two cannot be confused.
  const order = {
    ...fixtureOrder(fixtures.regular),
    shippingAddress: null,
    billingAddress: {
      formatted: ["1 Billing Street", "Ottawa ON K1A 0A1", "Canada"],
    },
  };

  expect(mapOrder(SHOP, order).order.customerAddress).toBe(
    "1 Billing Street, Ottawa ON K1A 0A1, Canada",
  );
});

it("BE-6 Fields not in order JSON : 1. maps a line item whose product is null", () => {
  const { lineItems, products } = mapOrder(
    SHOP,
    fixtureOrder(fixtures.productNull),
  );

  expect(lineItems).toContainEqual({
    id: "gid://shopify/LineItem/15129295716507",
    orderId: "gid://shopify/Order/6662859882651",
    productId: null,
    title: "テスト",
    quantity: 1,
  });
  // Only the other line item's product.
  expect(products.map((product) => product.id)).toEqual([
    "gid://shopify/Product/9478544294043",
  ]);
});
