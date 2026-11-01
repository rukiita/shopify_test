import type { OrderForIngestionQuery } from "../../types/admin.generated";

// The one query that reads an order for ingestion, from webhooks and from the sync
// of existing orders (ADR-0003). Test fixtures in test/fixtures/order-*.json are
// responses to this query, captured from the development store.
//
// - Total: currentTotalPriceSet in shop money, after refunds and order edits
// - Quantity: currentQuantity, after refunds and order edits
// - customer needs the read_customers scope
// - Line items: the first 250 only
export const ORDER_QUERY = `#graphql
  query OrderForIngestion($id: ID!) {
    order(id: $id) {
      id
      name
      number
      createdAt
      updatedAt
      email
      tags
      paymentGatewayNames
      currentTotalPriceSet {
        shopMoney {
          amount
          currencyCode
        }
      }
      customer {
        firstName
        lastName
      }
      shippingAddress {
        formatted(withName: false, withCompany: true)
      }
      billingAddress {
        formatted(withName: false, withCompany: true)
      }
      lineItems(first: 250) {
        nodes {
          id
          title
          currentQuantity
          product {
            id
            title
            tags
          }
        }
      }
    }
  }
`;

export type ShopifyOrder = NonNullable<OrderForIngestionQuery["order"]>;
