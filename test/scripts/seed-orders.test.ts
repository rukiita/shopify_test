import { expect, it } from "vitest";
import {
  DRAFT_ORDER_COMPLETE,
  DRAFT_ORDER_CREATE,
  PRODUCTS_QUERY,
  SEED_ORDER_COUNT,
  buildDraftOrderInputs,
  parseStore,
  readCliError,
  readOrder,
  readVariantIds,
  seedOrders,
  type Execute,
} from "../../scripts/seed-orders";
import productsResponse from "../fixtures/seed-products.json";
import createResponse from "../fixtures/seed-draft-order-create.json";
import completeResponse from "../fixtures/seed-draft-order-complete.json";
import userErrorsResponse from "../fixtures/seed-draft-order-create-user-errors.json";
import failedExecute from "../fixtures/seed-store-execute-failed.json";

// The fixtures are responses captured from the development store with
// `shopify store execute` (#120). Customer details in them are test values.

it("BE-7 Whole app : 4. the seed builds 53 draft order inputs, each with a variant from the store and a test customer", () => {
  const variantIds = readVariantIds(productsResponse);
  const inputs = buildDraftOrderInputs(variantIds);

  expect(variantIds).toHaveLength(13);
  expect(inputs).toHaveLength(SEED_ORDER_COUNT);
  expect(SEED_ORDER_COUNT).toBe(53);
  for (const input of inputs) {
    expect(input.lineItems).toHaveLength(1);
    expect(variantIds).toContain(input.lineItems[0].variantId);
    expect(input.email).toMatch(/@example\.com$/);
    expect(input.tags).toEqual(["seed"]);
    expect(input.shippingAddress.countryCode).toBe("US");
  }
  expect(new Set(inputs.map((input) => input.email)).size).toBe(
    SEED_ORDER_COUNT,
  );
  expect(new Set(inputs.map((input) => input.lineItems[0].variantId))).toEqual(
    new Set(variantIds),
  );
});

it("BE-7 Whole app : 4. the seed rejects a store without variants to order", () => {
  expect(() => buildDraftOrderInputs([])).toThrow(/no active products/);
});

it("BE-7 Whole app : 4. the seed reads the created order from a captured draftOrderComplete response", () => {
  expect(readOrder(completeResponse)).toEqual({
    id: "gid://shopify/Order/6674764234907",
    name: "#1057",
  });
});

it("BE-7 Whole app : 4. the seed stops and reports the count when a response has userErrors", async () => {
  let creates = 0;
  const execute: Execute = async (query) => {
    if (query === PRODUCTS_QUERY) return productsResponse;
    if (query === DRAFT_ORDER_CREATE) {
      creates += 1;
      return creates <= 2 ? createResponse : userErrorsResponse;
    }
    if (query === DRAFT_ORDER_COMPLETE) return completeResponse;
    throw new Error(`unexpected query: ${query}`);
  };

  const result = await seedOrders({ execute, concurrency: 1 });

  expect(result.created).toHaveLength(2);
  expect(result.error).toMatch(/Add at least 1 product/);
  expect(creates).toBe(3);
});

it("BE-7 Whole app : 4. the seed creates every order when several run at once", async () => {
  const execute: Execute = async (query) =>
    query === PRODUCTS_QUERY
      ? productsResponse
      : query === DRAFT_ORDER_CREATE
        ? createResponse
        : completeResponse;

  const result = await seedOrders({ execute, concurrency: 5 });

  expect(result.error).toBeUndefined();
  expect(result.created).toHaveLength(SEED_ORDER_COUNT);
});

it("BE-7 Whole app : 4. the seed reports the GraphQL error of a failed store execute", () => {
  expect(readCliError(JSON.stringify(failedExecute))).toBe(
    "Field 'notAField' doesn't exist on type 'Shop'",
  );
  expect(readCliError("not json")).toBeUndefined();
});

it("BE-7 Whole app : 4. the seed accepts only a myshopify.com store", () => {
  expect(parseStore(["--store", "order-tags-dev.myshopify.com"])).toBe(
    "order-tags-dev.myshopify.com",
  );
  expect(parseStore(["--store=order-tags-dev.myshopify.com"])).toBe(
    "order-tags-dev.myshopify.com",
  );
  expect(() => parseStore([])).toThrow(/--store/);
  expect(() => parseStore(["--store", "example.com"])).toThrow(
    /myshopify\.com/,
  );
});
