# 0004. Write order tags to Shopify as the single source of truth

- Status: Accepted
- Date: 2026-10-30
- Issue: #16 (DEC-4)

## Context

The task asks that merchants can add and remove tags on orders from the app, but does not say whether those tags should also be written to the Shopify order.
The app overwrites orders when `orders/updated` arrives (BE-1), so some ways of storing tags conflict with that overwrite.

## Options considered

1. Write to Shopify with `tagsAdd` / `tagsRemove`, and update the database too
2. Keep an app-specific tag table, separate from Shopify's tags
3. Update only the `tags` column in the app database

## Decision

Option 1. Shopify owns the data; the app database is a copy of it.
Option 3 does not work: the next `orders/updated` would revert the tags to Shopify's values.
Option 2 works, but it makes "Tags" in the CSV ambiguous, and the tags would not match what the merchant sees in the Shopify admin.

## Consequences

- Positive: no conflict with webhooks by construction. Tags match between the app and the Shopify admin
- Negative: requires the `write_orders` scope. Each tag operation is an API call
- Note: after a successful write, the database is updated immediately so the UI reflects it without waiting for the webhook. The later `orders/updated` carries the same values, so overwriting is harmless (stale ones are dropped by the `updatedAt` check from ADR-0003)
- Revisit when: internal tags that should not appear in Shopify become necessary

## References

- https://shopify.dev/docs/api/admin-graphql/latest/mutations/tagsAdd
