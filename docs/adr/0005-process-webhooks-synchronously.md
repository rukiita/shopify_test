# 0005. Process webhooks synchronously within the request

- Status: Proposed
- Date: 2026-11-01
- Issue: #17 (DEC-5)

## Context

Under ADR-0003, every order webhook (`orders/create`, `orders/updated`) triggers a GraphQL fetch of the order and a database write (`saveOrder`), both before the route responds.

Shopify's limits for HTTPS delivery ([Verify webhook deliveries](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries)):

- One second to connect and five seconds for the whole request. No response, or any status outside 2xx, is a failure
- A failed delivery is retried 8 times over 4 hours, at growing intervals. After that it is dropped
- After 8 consecutive failures, a subscription is deleted only if it was created with the Admin API. This app's subscriptions are in `shopify.app.toml` (app-specific), so failures lose deliveries but do not remove the subscription
- Shopify recommends a queue to absorb bursts and to respond within five seconds

## Options considered

1. Fetch and write within the request, then return 200
2. Enqueue a job, return 200 immediately, and process it in a separate worker

## Measurements

Measured on 2026-11-01 with throwaway timing code in `app/routes/webhooks.orders.tsx` (not committed).
Setup: `npm run dev` on WSL2 (4 CPUs), the development store, SQLite (`prisma/dev.sqlite`), Prisma 6.19, Admin API 2026-10.
Orders were created from draft orders and tagged with `shopify store execute`.
Times are measured inside the server; the time Shopify sees also includes the Cloudflare tunnel of `shopify app dev`.

**One delivery at a time.** 31 deliveries of `orders/create` and `orders/updated`, 5 to 12 seconds apart: orders with 3 line items, and one with 50.

| Step | Median | 90th percentile | Max |
|---|---|---|---|
| `authenticate.webhook` (HMAC, session) | 4 ms | 25 ms | 594 ms (first request after a restart) |
| GraphQL fetch (`ORDER_QUERY`) | 508 ms | 597 ms | 652 ms |
| `saveOrder` | 16 ms | 20 ms | 41 ms |
| Total | 538 ms | 619 ms | 1,085 ms |

- The order with 50 line items took 0.51 s and 0.59 s in total
- Query cost: 28 requested; 6 actual for 3 line items and 11 for 50. About 2,000 points were available, restored at 100 per second
- `saveOrder` alone, against the test database, for an order with 250 line items (the most that `ORDER_QUERY` fetches): 18–95 ms to create, 120–130 ms to overwrite

The GraphQL round trip is most of the time. The database write is small.

**Concurrent deliveries.** 10 orders created at once, then 10 orders tagged at once: about 30 deliveries within 30 seconds.
The first delivery stored took 5.9 seconds, past Shopify's limit.
The others failed inside `saveOrder` with a Prisma `Socket timeout` and returned 500.
The database stayed locked for 71 seconds: about 60 attempts failed, and three requests that finally succeeded took more than 60 seconds.
Once the lock cleared, Shopify's retries stored every order and tag within about 80 seconds of the burst, so nothing was lost this time.

Calling `saveOrder` concurrently against the test database shows the same: 2 or 3 at once succeed; with 5 or more at once, every call fails after 5 seconds or more.
The failure is in the database, not in processing within the request.
The likely cause: Prisma opens several SQLite connections (2 × CPUs + 1 by default), and transactions on different connections wait on each other's locks until Prisma's timeouts end them.
With one connection (`connection_limit=1` in the database URL), the same calls wait for the connection instead: 20 at once all succeeded in 0.25 s, and 10 orders with 250 line items each in 1.3 s.

## Decision

Option 1, with database writes serialized (#77).

- One delivery takes about 0.5 s, a tenth of Shopify's limit. Most of it is the GraphQL fetch, which a queue would not shorten
- The failure under concurrent deliveries comes from the database writes, not from where the work runs. A queue with one worker would serialize the writes, but so does one database connection, without a worker process or Redis
- Accepting this ADR depends on #77. Until it is merged, concurrent order webhooks fail as measured above

## Consequences

- Positive: simple setup. Reviewers can run the app from the README alone, with no worker or Redis
- Negative: the response waits for the Admin API. A slow fetch delays it directly (measured: 0.4–0.65 s)
- Negative: until #77, concurrent order webhooks fail and depend on Shopify's retries
- For production: process webhooks from a queue, use a database that allows concurrent writes (e.g. PostgreSQL), and reconcile missed orders (#21). Documented in the README under "Known limitations / Production considerations"
- Revisit when: the webhook response time on the Dev Dashboard (app Overview, 90th percentile) exceeds 2 seconds, or its Logs show failed order deliveries

## References

- https://shopify.dev/docs/apps/build/webhooks/verify-deliveries (timeouts, retries, queuing)
- https://shopify.dev/docs/apps/build/webhooks/troubleshoot (delivery metrics, response time, logs)
