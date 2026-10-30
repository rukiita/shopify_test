# 0003. Use webhooks as triggers and refetch orders via GraphQL

- Status: Proposed
- Date: 
- Issue: #15 (DEC-3)

## Context

The task asks to store orders in the database based on webhooks. The webhook payload alone cannot fill the CSV.

- Product tags are not part of the order data ("Need some fields not in order/id/.json" in the task)
- There are reports that even with protected customer data access approved, webhooks deliver addresses and similar fields as null or redacted

## Options considered

1. Store the payload as is, and fetch only the missing fields via the API
2. Use only `admin_graphql_api_id` from the payload and refetch the whole order via GraphQL

## Decision

Option 2. A single GraphQL query returns the order, customer, address, line items and products (`lineItems { product { title tags } }`).
Data has one source (the GraphQL response), so there is one mapping function (`order-mapper`).
The same path is reused to sync existing orders (#21).

## Consequences

- Positive: everything the CSV needs comes from one fetch. Webhooks and sync share the same ingestion path
- Negative: each webhook costs one API call against the rate limit (GraphQL query cost). Fetch failures need handling
- Revisit when: order volume makes the rate limit a problem

## References

- https://community.shopify.dev/t/orders-create-webhook-customer-data-is-redacted-even-after-protected-customer-data-approval/34610
- https://shopify.dev/docs/apps/build/webhooks (recommends reconciliation jobs rather than relying on webhooks alone)
