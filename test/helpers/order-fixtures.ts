import type { OrderForIngestionQuery } from "../../app/types/admin.generated";
import deletedOrder from "../fixtures/order-deleted.json";
import noCustomerOrder from "../fixtures/order-no-customer.json";
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
  deleted: response(deletedOrder),
};

// The order inside a fixture that has one.
export function fixtureOrder(fixture: OrderQueryResponse) {
  if (!fixture.data.order) throw new Error("This fixture has no order");
  return fixture.data.order;
}
