# Known limitations / Production considerations

English | [日本語](known-limitations.ja.md)

The full list. The [README](../README.md#known-limitations--production-considerations) has the main items.

## Scope decisions

- The app has not been submitted to the Shopify App Store. The compliance webhooks that Shopify requires are implemented (see [Customer data](database.md#customer-data)), but step 2 of the protected customer data request (data protection details) and App Store review are not done
- The repository has no Dockerfile or other deployment configuration. The app runs locally with `npm run dev`
- There is no CI: the repository has no GitHub Actions workflows, so tests, code reviews and security reviews run locally
- The CSV export reads all of a shop's orders and builds the file in memory within one request, which has not been measured on a large store. The read shares the one SQLite connection, and building the file holds the Node process, so order webhooks for every shop wait meanwhile and can pass Shopify's 5-second limit, which leaves them to Shopify's retries. For large stores, see [row 6](#6-large-data) (#5)
- Only the first 250 line items of an order are stored (one GraphQL page, `lineItems(first: 250)`). Line items beyond that are not stored and not in the CSV (#1)
- Order webhooks are processed within the request: the order is fetched and stored before the app responds ([Why webhooks are processed within the request](adr/0005-process-webhooks-synchronously.md)). One delivery takes about 0.5 s against Shopify's 5-second limit. Database writes run one at a time over one SQLite connection, so deliveries that arrive at the same time wait for each other (#77). A burst of more than about 75 large or 170 small orders at once (measured on the database write alone; through the route it may be fewer) fails in part and is left to Shopify's retries. For production, see [rows 1 to 3](#moving-to-production). No reconciliation job is planned; the sync ([step 6](setup.md#6-import-existing-orders)) can be run by hand and imports the orders from the last 60 days that are missing or changed
- `customers/data_request` only logs the request. Shopify asks apps to provide the requested data to the store owner directly, within 30 days ([privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)). For production, see [row 5](#5-customer-data) (#98)
- Access tokens and customer data are stored unencrypted in SQLite (`Session`, `Order`). The app uses names, emails and addresses, which makes it level 2 under Shopify's protected customer data requirements, and those include encrypting data at rest ([protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)). For production, see [row 5](#5-customer-data) (#98)
- The sync of existing orders runs within one request, one order at a time: it lists orders 250 per page, then fetches and writes each new or changed order as a webhook would. Its time grows with the number of orders to import (the same fetch and write take about 0.5 s per webhook delivery; the sync itself has not been measured on a large store). A request that Shopify answers with 429 or 503 is tried up to three times. The GraphQL rate limit is reported as a `THROTTLED` error with status 200, which is not retried: the sync stops, the orders imported before it stay, and running it again continues with the orders not imported yet. Fetching several orders at once is not done (#70). For large stores, see [row 6](#6-large-data) (#21)

## Known issues

- `read_customers` was added after the first install (#1). A store installed before that has it only once the merchant opens the app and approves the new scope. Until then the order query is denied, and order webhooks for that store fail and are retried
- The CSV has no currency column. *Total price* is in the currency the shop had when the order was last ingested, so the column can mix currencies after a shop changes its currency (#5)
- *Order id* is a plain number of 13 or more digits. Excel displays it in scientific notation (`6.674876E+12`, seen in Excel on 2026-11-06, #122), and saving the file from Excel can then write the rounded form (saving was not checked). Keep the original file, or import the column as text (#5)
- The `'` prefix stops a formula when the file is opened, but OWASP warns that Excel may strip quotes and escape characters after a file is saved and reopened (#5)
- `customers/redact` marks only orders the app has already stored. An order in `orders_to_redact` that is stored later (for example by the sync of existing orders) gets its customer fields as Shopify returns them then. `app/uninstalled` and `shop/redact` delete the shop's orders, and `customerRedacted` goes with them, so after a reinstall a sync can store the customer fields of a redacted order if Shopify returns them (#65, #98)
- An `app/uninstalled` delivery fails when the shop's offline token (the access token the app uses when no merchant is present) has expired, so the shop's data is not deleted. `authenticate.webhook` refreshes an expired token before the route's code runs. In a check on a development store, the session's `expires` was set one hour into the past, with the refresh token's own expiry still months away, and the app was uninstalled. The three deliveries seen returned 500, `Received APP_UNINSTALLED` was not logged, and the `Session` row was still there 5 minutes later. An uninstall earlier the same day, with a session that had not expired, returned 200 and deleted the rows. Not confirmed: that the refresh is the cause (the app logs nothing for it, so this is read from the library's code and the difference between the two uninstalls), the result of Shopify's remaining retries, a token that expired by itself, and `shop/redact` and `customers/redact` in this state, which go through the same code and are expected to fail the same way while the session remains. For production, see [row 5](#5-customer-data) (#95)
- A signed `app/uninstalled` delivery can be sent again. The signature covers only the body, and the app does not record which deliveries it has handled, so a past delivery's body and signature, resent after a reinstall, delete the new install's orders, products and offline session (the stored session that holds that token). Checking the shop in the signed payload (#94) does not stop this, because the body names the same shop. The fix suggested for #74 below does not cover it either: `triggeredAt` comes from the `X-Shopify-Triggered-At` header, which the signature does not cover, so the sender can set it. This was read from the code, not reproduced, and no fix has been chosen. [Row 4](#4-repeated-webhooks) gives the design for production and its limit (#98)
- `shop/redact` cannot tell a missed `app/uninstalled` from a reinstall. `app/uninstalled` deletes the shop's sessions, so the route treats any remaining session as a reinstall: it responds 200 and deletes nothing. A session also remains when `app/uninstalled` never succeeded, for example after an outage longer than Shopify's retry window, and then the shop's orders with their customer data stay. With an expired token (#95), `shop/redact` is expected to fail before it reaches this check, and the data stays too. `Session` has no creation time that could tell the two cases apart. For production, see [row 4](#4-repeated-webhooks) (#97)
- A late `app/uninstalled` retry can delete a reinstalled shop's data. If the first delivery fails and the merchant reinstalls within Shopify's retry window (8 retries over 4 hours), the retry deletes the new install's orders, products and offline session, and order webhooks then store nothing until the merchant opens the app again. The fix for production, comparing the delivery's `triggeredAt` with the install time, is in [row 4](#4-repeated-webhooks) (#74)
- `app/uninstalled` depends on `myshopify_domain`, which has been checked on real deliveries from one development store only, while Shopify's documented sample has null. A genuine delivery with null or another value would return 401 and log `Rejected APP_UNINSTALLED webhook`. Shopify would retry it and give up (8 retries over 4 hours), so the orders with their customer data and the session would stay. `shop/redact` would then delete nothing 48 hours later, because it treats the session as a reinstall. For production, see [row 7](#7-deployment-and-monitoring) (#94)
- The form for adding a tag has no `method` or `action`, so submitting it before the page has hydrated is expected to send a plain GET to `/app?tag=...`. That loses the `shop` and `host` parameters of the embedded app, so authentication can redirect or fail. No tag is written. This was read from the code, not reproduced. In production, disable the controls until hydration (#84, #70)
- `updatedAt` has one-second precision, and a fetch with an equal value is written, because it can carry a later change made in the same second. So a webhook's fetch from before a tag edit, in the same second as the edit, can undo the edit in the stored copy if it is written last. The copy stays that way until the order next changes, and a sync does not repair it, because it skips orders with the same `updatedAt` (#3)

## Moving to production

How the design would change for production, with the reasoning and evidence for each row of the table in the [README](../README.md#moving-to-production). None of this is built. The evidence is measurements and checks in this repository, and facts from the documentation of the platform and of the database in use.

### 1. Responding and processing

- **Bottleneck:** The response waits for the work: a webhook is answered only after the order is fetched and stored, which takes about 0.5 s
- **Design for production:** Separate acceptance from processing. Verify the signature, put the delivery in a durable queue and respond. Another process fetches and stores the order, and retries on failure
- **Reason:** Processing time and bursts of orders no longer decide whether the response meets the deadline. The queue has to be durable because Shopify retries only after no response or an error: once the app has responded, a delivery held only in memory is lost if the process stops
- **Evidence:**
  - One delivery takes a median of 538 ms, with a 90th percentile of 619 ms ([ADR-0005](adr/0005-process-webhooks-synchronously.md)). Shopify has "a five-second timeout for the entire request" ([Respond with a 200 OK quickly](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#respond-with-a-200-ok-quickly))
  - 39 deliveries within 8 s were all stored on the first attempt ([ADR-0005](adr/0005-process-webhooks-synchronously.md), [PR #81](https://github.com/rukiita/shopify_test/pull/81))
  - Serialized writes absorb a burst only up to a limit: about 170 small or 75 large orders at once. These were measured on the database write alone, and through the route the limit may be lower. With 2 line items, 150 at once were all stored and 200 at once had 23 failures. With 250 line items, 60 at once were all stored and 80 at once had 2 failures ([ADR-0005](adr/0005-process-webhooks-synchronously.md), [PR #81](https://github.com/rukiita/shopify_test/pull/81))
  - "Queuing is a useful pattern for handling bursts of traffic and for ensuring you respond within five seconds" ([Queue webhooks to handle traffic bursts](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#queue-webhooks-to-handle-traffic-bursts))
  - "If Shopify receives no response or an error, it retries 8 times over the next 4 hours" ([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))

### 2. Database writes

- **Bottleneck:** Writes run one at a time over one connection to one database file, which also ties the app to one machine
- **Design for production:** A database that accepts concurrent writes, and an app that keeps no state, so several instances can run
- **Reason:** Capacity grows with instances, and one failure does not stop the app
- **Evidence:**
  - "SQLite only supports one writer at a time per database file" ([Appropriate Uses For SQLite](https://www.sqlite.org/whentouse.html))
  - With several connections, concurrent writes failed. On the test database, 2 or 3 writes at once succeeded, and with 5 or more every call failed after 5 s or more. On the development store, a burst of about 30 deliveries within 30 s left the database locked for 71 s. The likely cause is transactions on different connections waiting on each other's locks until timeouts end them ([ADR-0005](adr/0005-process-webhooks-synchronously.md), [#77](https://github.com/rukiita/shopify_test/issues/77))
  - One connection removed those failures for the bursts measured, but every other query now waits behind order writes during a burst ([ADR-0005](adr/0005-process-webhooks-synchronously.md))

### 3. Missed webhooks

- **Bottleneck:** Only webhooks keep the copy current, and recovering a missed one depends on someone pressing **Sync orders**
- **Design for production:** Add periodic reconciliation: fetch the orders changed since the last run, and fill in missed webhooks
- **Reason:** Delivery is not guaranteed, and retries end
- **Evidence:**
  - "Webhook delivery isn't always guaranteed", so "use reconciliation jobs to periodically fetch data from Shopify" ([Implement reconciliation jobs](https://shopify.dev/docs/apps/build/webhooks#implement-reconciliation-jobs)). The same page also accepts a button like **Sync orders** as a way to reconcile. The gap here is that it runs only when someone presses it
  - Shopify "retries 8 times over the next 4 hours" ([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))
  - Deliveries do fail: with a token's expiry set one hour into the past by hand, `app/uninstalled` returned 500 on the three deliveries seen ([#95](https://github.com/rukiita/shopify_test/issues/95))

### 4. Repeated webhooks

- **Bottleneck:** Handled webhooks are not recorded. Repeated order webhooks are absorbed by idempotent writes and the `updatedAt` check, but a deletion webhook sent again deletes a reinstalled shop's data
- **Design for production:** Record handled webhooks and skip repeats. Store the time of install, which `Session` does not have today, and compare deletion webhooks with it
- **Reason:** The same webhook can arrive more than once, and a deletion cannot be undone
- **Limit:** The delivery ID and the delivery time are headers, which the signature does not cover, so recording deliveries does not fully stop a resent delivery. It catches the repeats Shopify sends. Someone who has a past body and signature can send them again with a new ID and time
- **Evidence:**
  - Shopify says "your app might receive the same webhook more than once, for example after a network timeout or a retry", and describes detecting duplicates by storing `X-Shopify-Webhook-Id` ([Ignoring duplicates](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#ignoring-duplicates))
  - The signature is "generated using your app's client secret and the raw request body" ([HMAC verification](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#hmac-verification)). `X-Shopify-Webhook-Id` and `X-Shopify-Triggered-At` are headers ([Headers](https://shopify.dev/docs/apps/build/webhooks/delivery-structure#headers))
  - A late retry can delete a reinstalled shop's data ([#74](https://github.com/rukiita/shopify_test/issues/74)), `shop/redact` cannot tell a missed `app/uninstalled` from a reinstall ([#97](https://github.com/rukiita/shopify_test/issues/97)), and a resent delivery was read from the code, not reproduced ([#98](https://github.com/rukiita/shopify_test/issues/98))

### 5. Customer data

- **Bottleneck:** Customer data is handled as in development: it is not encrypted at rest, data requests are only logged, and deletion webhooks depend on the session and fail with an expired token
- **Design for production:** Encrypt at rest, provide the stored data to the store owner within the required time, and let deletion run on the signature alone, without the session
- **Reason:** These are platform requirements, and deletion must happen
- **Evidence:**
  - An app using "name, address, phone, or email fields" must "meet all of the level 1 and 2 requirements". Requirement 9 of level 1 is "Encrypt data at rest and in transit", and level 2 adds "Encrypt your data backups" ([Protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data#requirements))
  - "Complete the action within 30 days of receiving the request", and a data request lists the customer data "that you need to provide to the store owner directly" ([Privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance))
  - With an expired token, `app/uninstalled` did not delete the shop's data. The other two deletion routes were not checked, and the cause was read from the library's code ([#95](https://github.com/rukiita/shopify_test/issues/95))

### 6. Large data

- **Bottleneck:** Large data is handled in one piece: one page of 250 line items, the CSV built in memory within one request, and the sync run one order at a time
- **Design for production:** Split the work: page through line items, stream the CSV or build it in the background and hand it over later, and run the sync as a background bulk fetch
- **Reason:** Large stores would lose data, slow down, or hold up other work
- **Evidence:**
  - `lineItems(first: 250)` in `app/lib/shopify/order-query.ts`: line items beyond that are not stored ([#1](https://github.com/rukiita/shopify_test/issues/1))
  - The CSV and the sync have not been measured on a large store. The CSV's read shares the one connection and building the file holds the app's process, so order webhooks wait meanwhile ([#5](https://github.com/rukiita/shopify_test/issues/5)). The sync's time grows with the number of orders to import ([#21](https://github.com/rukiita/shopify_test/issues/21))

### 7. Deployment and monitoring

- **Bottleneck:** The app runs only on a developer's machine, and failures go unnoticed: there is no deployment configuration, CI or monitoring
- **Design for production:** Automate build, test and deployment, monitor failed and rejected webhooks and alert on them, and keep secrets outside the code
- **Reason:** An unnoticed failure lasts until retries end and data is lost
- **Evidence:**
  - After consecutive failures, "Warning emails are sent to the app's emergency developer email address". The app has no monitoring of its own ([Retries and failures](https://shopify.dev/docs/apps/build/webhooks/verify-deliveries#retries-and-failures))
  - `myshopify_domain` has been checked on one development store only. A genuine delivery with null or another value would be rejected and log `Rejected APP_UNINSTALLED webhook`, so alert on that log line and check the field on more stores ([#94](https://github.com/rukiita/shopify_test/issues/94))
  - CI is tracked in [#115](https://github.com/rukiita/shopify_test/issues/115), which is still open

### 8. Dependencies

- **Bottleneck:** Dependencies stay at the template's versions, with 6 known issues in production dependencies
- **Design for production:** Update dependencies regularly and keep auditing them
- **Reason:** The packages with the current issues do not handle request data, but issues accumulate
- **Evidence:** The audit of production dependencies reports 6 issues (4 high, 2 moderate), from two root causes ([Dependency audit](#dependency-audit)). It was re-run on 2026-11-04 ([PR #103](https://github.com/rukiita/shopify_test/pull/103)) and on 2026-11-06, with the same counts. The full audit's 39 issues date from 2026-10-31 and were not re-checked

## Dependency audit

The app was scaffolded from [`shopify-app-template-react-router`](https://github.com/Shopify/shopify-app-template-react-router) version **2026.10.09**, and keeps the dependency versions it pins.

`npm audit` on a clean install (`npm ci`, 2026-10-31) reports 39 issues (26 high, 13 moderate). Most come from development-only tools (ESLint, GraphQL codegen, the Prisma CLI). Limited to production dependencies (`npm audit --omit=dev`), there are 6 (4 high, 2 moderate), from two root causes:

| Package | Reached through | Issue | Why the risk is low here |
|---|---|---|---|
| `deepmerge-ts` | `prisma` → `@prisma/config` | Stack exhaustion when merging recursive objects | Used when Prisma loads its configuration, not on request data |
| `minimatch` | `@react-router/fs-routes` | Denial of service through globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) | Used to match route file names at build time, not on request data |

Fixing `deepmerge-ts` requires a major upgrade (Prisma 7), and fixing the development-only issues requires newer ESLint / TypeScript ESLint. These upgrades would diverge from the template and risk the database work in this task, so they are deferred. `npm audit` reports no fix for `minimatch`: `@react-router/fs-routes` depends on version 9, and the advisory is fixed in 11.0.1. In production, make these upgrades, re-run `npm audit`, and check `minimatch` again ([row 8](#8-dependencies)).
