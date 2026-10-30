# 0005. Process webhooks synchronously within the request

- Status: Proposed
- Date: 
- Issue: #17 (DEC-5)

## Context

Under ADR-0003, every webhook triggers a GraphQL fetch and a database upsert.
Shopify webhooks time out after about five seconds, and subscriptions can be removed after repeated failures.

## Options considered

1. Fetch and upsert within the request, then return 200
2. Enqueue a job, return 200 immediately, and process it in a separate worker

## Decision

Option 1 (tentative). At the scale of this task (a development store with dozens of orders), fetching and upserting should finish well within five seconds, and the benefit does not justify adding queue infrastructure (Redis, a worker).
Measure processing time in Step 3 and accept only once there is clear headroom.

## Consequences

- Positive: simple setup. Reviewers can run the app from the README alone
- Negative: risk of timeouts under bursts of orders or slow API responses
- For production: move to a queue (e.g. BullMQ + Redis, or a managed queue service). Documented in the README under "Production considerations"
- Revisit when: measured processing time exceeds one second

## References

- https://hookdeck.com/webhooks/platforms/shopify-webhooks-features-and-best-practices-guide (5-second timeout)
