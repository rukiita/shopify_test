# Database design

The ER diagram and the main choices are in the [README](../README.md#database). This file has the rest.

The database is SQLite, managed with Prisma (`prisma/schema.prisma`). Orders, line items and products are copies of Shopify data. Shopify owns the data ([Why tags are written to Shopify first](adr/0004-sync-tags-to-shopify.md)). The copies are written in four ways:

- **Ingestion:** an `orders/create` or `orders/updated` webhook, or the sync of existing orders ([step 6](setup.md#6-import-existing-orders)), re-fetches the order (reads it again from the Admin API) and writes the order, its line items and their products. An order and its line items are written unless Shopify's `updatedAt` is older than the stored `shopifyUpdatedAt` (an equal value is written: `updatedAt` has one-second precision, so it can carry a later change made in the same second), a guard for two fetches of the same order running at the same time ([Why the app re-fetches each order](adr/0003-refetch-order-via-graphql.md)). Each product is written the same way, unless the product's own `updatedAt` is older than its stored `shopifyUpdatedAt`: two orders with the same product can be ingested at the same time
- **Tag edits:** adding or removing an order tag in the app writes to Shopify first, then to the database ([Why tags are written to Shopify first](adr/0004-sync-tags-to-shopify.md))
- **Compliance webhooks:** `customers/redact` empties an order's customer fields, and `shop/redact` deletes an uninstalled shop's data (see [Customer data](#customer-data))
- **Deletion:** the app does not subscribe to Shopify's delete webhooks (`orders/delete`, `products/delete`), so deletions in Shopify are not received (see "Delete behaviour" under [Design choices](#design-choices))

## Tables

| Table | Holds | Notes |
|---|---|---|
| `Order` | One row per Shopify order, scoped to a shop | `customerAddress` is one formatted string (shipping, falling back to billing). `customers/redact` sets `customerEmail`, `customerFullName` and `customerAddress` to null and `customerRedacted` to true, and later ingestions keep the three fields null (see [Customer data](#customer-data)) |
| `LineItem` | One row per line item of an order | `productId` is null when the line item had no product the last time its order was ingested: a custom item, or a product already deleted in Shopify |
| `Product` | One row per product seen on an ingested order, scoped to a shop | Title and tags as fetched with an order containing the product, written by each ingestion of such an order. `shopifyUpdatedAt` is the product's `updatedAt` in Shopify, so when two such ingestions run at the same time, the older fetch is not written over the newer one. `app/uninstalled` and `shop/redact` delete a shop's products |
| `Session` | Shopify OAuth sessions, from the app template | Unchanged from the template; not related to the other tables, so not in the diagram |

## Design choices

**Shopify GIDs are the primary keys** (`gid://shopify/Order/...`, `.../LineItem/...`, `.../Product/...`).

- The webhook carries the GID (`admin_graphql_api_id`), and the GraphQL refetch ([ADR-0003](adr/0003-refetch-order-via-graphql.md)) takes it as is
- Upserting the same object twice hits the same row, so a repeated webhook creates no duplicate
- No mapping between an app ID and a Shopify ID is needed

**`Product` is a separate table.** A product is shared by many line items, across orders, and the CSV needs the product's own title and tags rather than what the line item carries (see [Interpretation of the task](interpretation.md#interpretation-of-the-task)). Storing them once per product means every line item of that product shows the same values. They are refreshed whenever an order containing the product is ingested, not when the product itself changes. `LineItem.title` keeps the title at purchase as the fallback when the line item has no product.

**Delete behaviour.** The app subscribes to `orders/create`, `orders/updated` and `app/uninstalled`, and to the compliance webhooks `customers/data_request`, `customers/redact` and `shop/redact`. None of them reports a deleted order or product, so a deletion in Shopify does not delete rows here. `app/uninstalled` deletes the shop's orders, line items, products and sessions, on every delivery of it whose signed payload names that shop (see [Customer data](#customer-data)). `shop/redact`, which Shopify sends 48 hours after the uninstall, deletes the shop's orders, line items and products again, so anything written after `app/uninstalled` is removed too. If the app was installed again in those 48 hours, `shop/redact` deletes nothing. What `customers/redact` changes is under [Customer data](#customer-data).

A product deleted in Shopify shows up only on orders ingested again afterwards. For a deleted product the refetch returns no product (`product: null`, confirmed with a captured response in #6), so `productId` becomes null and the CSV falls back to the title at purchase. Other orders containing that product keep showing its stored title and tags.

The foreign keys define what happens when a row is deleted in the app's database. Deleting an order deletes its line items (`onDelete: Cascade`). Deleting a product keeps its line items and sets their `productId` to null (`onDelete: SetNull`), so the order and the title at purchase stay in the CSV. `app/uninstalled` and `shop/redact` delete a shop's orders (their line items go with them) and its products.

**Tags and payment gateways are JSON arrays in String columns**, e.g. `["VIP","wholesale"]`. SQLite has no array type. JSON keeps a value unambiguous whatever characters it contains (a comma-separated string would not), and adding or removing one tag is an array operation. Filtering by tag in SQL is not needed by the current requirements.

**The order total is an integer in the currency's minor unit** (`totalPriceMinor`: 11.99 USD → `1199`, 1500 JPY → `1500`), stored with `currencyCode`. A String column cannot be summed with Prisma's `_sum`, and a Prisma `Decimal` on SQLite is stored as a floating-point REAL, so the total is kept as an integer. Totals across orders are summed per currency. The column is a `BigInt`, which Prisma returns as a JavaScript `bigint`. A 32-bit `Int` would cap one order at 2,147,483,647 minor units (about 21 million USD, or 2.1 million in a 3-decimal currency such as KWD), and one larger order would make every query that returns its row fail.

**Indexes.** `Order(shop, shopifyCreatedAt)` serves the order list (a shop's orders, newest first). `LineItem(orderId)` and `LineItem(productId)` are indexed because SQLite does not index foreign keys on its own. `Product(shop)` is not a foreign key index (`shop` is a plain column). It serves deleting a shop's products on `app/uninstalled` and `shop/redact`.

## Customer data

The app stores three customer fields, on `Order` only: `customerEmail`, `customerFullName` and `customerAddress`. They are copied from the merchant's own orders in Shopify. No other table holds customer data, and the app does not store the Shopify customer ID.

Shopify requires every public app, listed on the App Store or not, to handle three compliance webhooks. The app subscribes to them in `shopify.app.toml` (`compliance_topics`). Each route verifies the HMAC signature and returns 401 for an invalid one. The shop comes from the `X-Shopify-Shop-Domain` header, which the signature does not cover, so the two redaction routes also return 401 when the signed payload's `shop_domain` names another shop. Otherwise each route responds 200 after doing the following:

| Topic | When Shopify sends it | What the app does |
|---|---|---|
| `customers/redact` | 10 days after a merchant requests the deletion of a customer's data | Sets the three customer fields to null on the orders listed in `orders_to_redact`, within the shop, and sets `customerRedacted`. A later ingestion of such an order (for example `orders/updated` after a refund) keeps the three fields null, whatever Shopify returns. The order, its line items and tags stay, as they do in Shopify. Listed orders the app never stored are skipped |
| `shop/redact` | 48 hours after the app is uninstalled | Deletes the shop's orders, line items and products, as `app/uninstalled` does. If the shop has a session again (the app was installed again in those 48 hours), it deletes nothing: `app/uninstalled` deletes the sessions, and the data then belongs to the new install. Shopify's documentation does not say whether a reinstall cancels `shop/redact` |
| `customers/data_request` | When a customer asks a merchant for their data | Nothing beyond logging the topic and shop; customer details are not logged. The app sends nothing to the customer. The stored fields are copies of the merchant's own orders, so the merchant already has them in the Shopify admin. The app's order list shows the name and email, and the CSV export shows all three |

Orders are matched by ID only (`orders_to_redact`, numeric IDs turned into GIDs, Shopify's global IDs such as `gid://shopify/Order/…`), because the app does not store the customer ID. Customer data on an order not in that list stays. The routes do not need a session, so redaction also runs after the app was uninstalled.

`app/uninstalled` is not a compliance webhook, but it deletes the same data and has the same check: it returns 401 and deletes nothing unless the signed payload's `myshopify_domain` is the shop in the header. A real delivery captured from the development store has the shop's domain in that field, although Shopify's documented sample has null.

To check the routes by hand, run the app (`npm run dev`) and send Shopify's sample payloads with `npx shopify app webhook trigger --topic customers/data_request` (or `customers/redact`, `shop/redact`), giving the app's local address and client secret when asked. `customers/data_request` returns 200. The two redaction routes return 401 for the samples: their `shop_domain` is the placeholder `{shop}.myshopify.com`, which does not match the shop in the header. The redaction itself is covered by the route tests (`test/routes/webhooks.customers.redact.test.ts`, `test/routes/webhooks.shop.redact.test.ts`).

`app/uninstalled` also rejects its sample, which has `"myshopify_domain": null`, so a 401 with `--topic app/uninstalled` is expected. `npm run dev` sends this kind of sample to the route by itself when the app's client ID differs from the previous run, which includes the first run and a run after `config:link`. The CLI then prints `APP_UNINSTALLED webhook delivery failed` and the local data stays.
