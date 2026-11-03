import type {
  OrderForIngestionQuery,
  OrderIdsForSyncQuery,
} from "../../app/types/admin.generated";
import deletedOrder from "../fixtures/order-deleted.json";
import orderIdsPage1 from "../fixtures/order-ids-page-1.json";
import orderIdsPage2 from "../fixtures/order-ids-page-2.json";
import noCustomerOrder from "../fixtures/order-no-customer.json";
import productChangedOrder from "../fixtures/order-product-changed.json";
import productNullOrder from "../fixtures/order-product-null.json";
import regularOrder from "../fixtures/order-regular.json";

export interface OrderQueryResponse {
  data: OrderForIngestionQuery;
}

// Responses to ORDER_QUERY captured from the development store (test/fixtures/).
// The one cast is needed because codegen types enums such as CurrencyCode as
// TypeScript enums, which a JSON string literal does not satisfy.
const response = (json: unknown) => json as OrderQueryResponse;

export const fixtures = {
  regular: response(regularOrder),
  noCustomer: response(noCustomerOrder),
  productNull: response(productNullOrder),
  // Captured after one product was renamed and retagged and the other deleted.
  productChanged: response(productChangedOrder),
  deleted: response(deletedOrder),
};

// The order inside a fixture that has one.
export function fixtureOrder(fixture: OrderQueryResponse) {
  if (!fixture.data.order) throw new Error("This fixture has no order");
  return fixture.data.order;
}

// The order inside a fixture, with this many copies of its first line item, each with
// its own title and product. The development store has no order this large to capture.
export function orderWithLineItems(fixture: OrderQueryResponse, count: number) {
  const order = fixtureOrder(fixture);
  const [lineItem] = order.lineItems.nodes;
  if (!lineItem?.product) {
    throw new Error("This fixture's first line item has no product");
  }
  const { product } = lineItem;
  return {
    ...order,
    lineItems: {
      nodes: Array.from({ length: count }, (_, index) => ({
        ...lineItem,
        id: `gid://shopify/LineItem/${index + 1}`,
        title: `Title at purchase ${index + 1}`,
        product: {
          ...product,
          id: `gid://shopify/Product/${index + 1}`,
          title: `Product ${index + 1}`,
        },
      })),
    },
  };
}

// The order inside a fixture after a full refund: a total of 0 and no quantity left.
// Not captured from the development store: only these values differ from the fixture.
export function refundedOrder(fixture: OrderQueryResponse) {
  const order = fixtureOrder(fixture);
  return {
    ...order,
    currentTotalPriceSet: {
      shopMoney: { ...order.currentTotalPriceSet.shopMoney, amount: "0.0" },
    },
    lineItems: {
      nodes: order.lineItems.nodes.map((lineItem) => ({
        ...lineItem,
        currentQuantity: 0,
      })),
    },
  };
}

// Two pages of ORDER_IDS_QUERY captured from the development store: the orders of
// productChanged and noCustomer, then the order of productNull. Captured with
// `first: 2` and a filter on those three IDs, so that the store's other orders do
// not appear and the first page has a next page.
export const orderIdPages: { data: OrderIdsForSyncQuery }[] = [
  orderIdsPage1,
  orderIdsPage2,
];
