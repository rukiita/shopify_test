# 0003. Use webhooks as triggers and refetch orders via GraphQL

- Status: Accepted
- Date: 2026-10-30
- Issue: #15 (DEC-3)

## Context

The task asks to store orders in the database based on webhooks. The webhook payload alone cannot fill the CSV.

- Product tags are not part of the order data ("Need some fields not in order/id/.json" in the task)
- There are reports that even with protected customer data access approved, webhooks deliver addresses and similar fields as null or redacted

## Options considered

1. Store the payload as is, and fetch only the missing fields via the API
2. Use only `admin_graphql_api_id` from the payload and refetch the whole order via GraphQL

## Decision

Option 2.

Option 1 would not save an API call: product tags are never in the order payload,
so every webhook needs a fetch regardless. Given that, refetching the whole order is simpler:

- **One data source.** A single GraphQL query returns the order, customer, address, line items
  and products (`lineItems { product { title tags } }`). The REST-style payload (numeric IDs,
  snake_case) never has to be merged with GraphQL data (GIDs, camelCase), so there is one
  mapping function (`order-mapper`).
- **One ingestion path.** Syncing existing orders (#21) must use GraphQL anyway, so webhooks
  and sync share the same fetch → map → upsert path.
- **Always current.** The refetch returns the order as it is now, so a stale webhook that
  arrives late still stores up-to-date data. The `updatedAt` check stays as a guard when two
  fetches for the same order run at the same time.

## Consequences

- Positive: everything the CSV needs comes from one fetch. Webhooks and sync share the same ingestion path
- Negative: each webhook costs one API call against the rate limit (GraphQL query cost). Ingestion depends on the API at webhook time: on a fetch failure the route returns non-2xx and Shopify retries the delivery
- Revisit when: order volume makes the rate limit a problem

## References

- https://community.shopify.dev/t/orders-create-webhook-customer-data-is-redacted-even-after-protected-customer-data-approval/34610
- https://shopify.dev/docs/apps/build/webhooks (recommends reconciliation jobs rather than relying on webhooks alone)
