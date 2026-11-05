# Shopify Order Tags

A Shopify app that captures orders through webhooks, lets merchants add and remove order tags, and exports orders to CSV.

## Contents

- [Features](#features)
- [Reviewer's guide](#reviewers-guide)
- [Screenshots](#screenshots)
- [Installation and configuration](#installation-and-configuration)
- [Database design](#database-design)
- [Interpretation of the task](#interpretation-of-the-task)
- [Implementation choices](#implementation-choices)
- [Development process](#development-process)
- [Known limitations / Production considerations](#known-limitations--production-considerations)

## Features

The app is embedded in the Shopify admin. Its home page is the order list.

- **Order ingestion:** `orders/create` and `orders/updated` webhooks keep a copy of each order, its line items and their products in the app's database
- **Import of existing orders:** **Sync orders** imports orders from the last 60 days that are not stored yet or have changed
- **Order list:** orders newest first, 50 per page, with number, date, customer, email, total, payment gateway and tags
- **Order tags:** merchants add a tag from the order's row and remove one with the button next to it. Tags are written to Shopify, so they also appear in the Shopify admin
- **CSV export:** **Export CSV** downloads all of the shop's orders, one row per line item, including each product's title and tags. [`samples/orders.csv`](samples/orders.csv) is a sample
- **Customer data:** the app handles Shopify's compliance webhooks and deletes a shop's data when the app is uninstalled (see [Customer data](#customer-data))

## Reviewer's guide

Where to start for each requirement in [docs/requirements.md](docs/requirements.md): the main code, one test file, and the decision behind it.

| Requirement | Implementation | Tests | Decision |
|---|---|---|---|
| BE-1 Orders from webhooks | `app/routes/webhooks.orders.tsx`, `app/lib/ingest-order.server.ts` | `BE-1 Webhook ingestion`: `test/routes/webhooks.orders.test.ts` | [ADR-0003](docs/adr/0003-refetch-order-via-graphql.md), [ADR-0005](docs/adr/0005-process-webhooks-synchronously.md) |
| BE-2 Order list | `app/routes/app._index.tsx`, `app/components/order-table.tsx` | `BE-2 Order list`: `test/routes/app._index.test.ts` | [ADR-0002](docs/adr/0002-polaris-web-components.md), [Order list columns](#order-list-columns) |
| BE-3 Add tag | `app/routes/app.tags.tsx`, `app/lib/tag-order.server.ts` | `BE-3 Add tag`: `test/routes/app.tags.test.ts` | [ADR-0004](docs/adr/0004-sync-tags-to-shopify.md), [Order tags](#order-tags) |
| BE-4 Remove tag | `app/routes/app.tags.tsx`, `app/lib/tag-order.server.ts` | `BE-4 Remove tag`: `test/routes/app.tags.test.ts` | [ADR-0004](docs/adr/0004-sync-tags-to-shopify.md), [Order tags](#order-tags) |
| BE-5 CSV export | `app/routes/app.export.tsx`, `app/lib/domain/orders-csv.ts` | `BE-5 CSV export`: `test/domain/orders-csv.test.ts` | [CSV rows](#csv-rows-one-row-per-line-item), [CSV format](#csv-format) |
| BE-6 Fields not in the order JSON | `app/lib/shopify/order-query.ts`, `app/lib/domain/order-mapper.ts` | `BE-6 Fields not in order JSON`: `test/repositories/order-repository.test.ts` | [ADR-0003](docs/adr/0003-refetch-order-via-graphql.md), [Product title](#product-title-the-products-own-title-falling-back-to-the-title-at-purchase), [Product tags](#product-tags-as-fetched-with-an-order-containing-the-product) |
| SUB-1 Regular commits | The commit history | None (document) | [ADR-0006](docs/adr/0006-tdd.md), [Reading the commit history](#reading-the-commit-history) |
| SUB-2 Database design | `prisma/schema.prisma` | `BE-7 Whole app : 3`: `test/database/schema.test.ts` | [Database design](#database-design) |
| SUB-3 Screenshots | `docs/images/features/` | None (document) | [Screenshots](#screenshots) |
| SUB-4 Sample CSV | `samples/orders.csv` | `BE-5 CSV export : 1`: `test/domain/orders-csv-sample.test.ts` | [CSV format](#csv-format) |
| SUB-5 Install and configuration | `shopify.app.toml`, `shopify.web.toml` | None (document) | [Installation and configuration](#installation-and-configuration) |
| SUB-6 Implementation choices | `docs/adr/README.md` | None (document) | [Implementation choices](#implementation-choices) |

Test names start with the prefix shown ([test naming](docs/requirements.md#test-naming)), so `npx vitest run -t "BE-3 Add tag"` runs all of a requirement's tests, in every file. Not in the table: the sync of existing orders (`app/routes/app.sync.tsx`, `BE-1 Webhook ingestion : 3`), and the app lifecycle and compliance webhooks (`BE-7 Whole app : 1`, [Customer data](#customer-data)).

## Screenshots

### Order list

![The order list, with buttons to sync orders and export a CSV file](docs/images/features/order-list.png)

### Empty state

![The order list with no orders yet, and the button to sync orders](docs/images/features/empty-state.png)

### Tag editing

![An order with a tag and its remove button, and the field for adding a tag](docs/images/features/tag-editing.png)

### CSV download

![The exported CSV file open in a spreadsheet](docs/images/features/csv-download.png)

## Installation and configuration

Shopify admin labels are given as they appear in English. If a screen has changed, the linked Shopify documentation has the current steps.

### Prerequisites

- Node.js **24.22.1** (pinned in `.nvmrc`; with nvm, run `nvm use`). The app also declares `>=22.12` in `package.json`, and `.npmrc` makes `npm` refuse older versions, but 24.22.1 is the version it was built and tested with
- A Shopify Partner account with an organization ([partners.shopify.com](https://partners.shopify.com)). Without an organization, Shopify CLI stops with "No Organization found"

Shopify CLI is a project dependency (`@shopify/cli` in `dependencies`), so no global install is needed. Run it through the npm scripts or `npx shopify`.

### 1. Install dependencies and connect your own app

```bash
nvm use               # Node.js version from .nvmrc
npm ci                # install exactly the versions in package-lock.json
npm run config:link   # create or select an app in your own organization
```

`shopify.app.toml` contains the author's `client_id`. Because that file exists, `config:link` asks for a configuration name and creates `shopify.app.{name}.toml` for your app, which becomes the default for `npm run dev`. See [Manage app config files](https://shopify.dev/docs/apps/build/cli-for-apps/manage-app-config-files).

The new file is filled from your app in Shopify, so it does not have everything this app needs. For a newly created app, it has the scopes, but no webhook subscriptions and a different `api_version`. Copy the `[access_scopes]` and `[webhooks]` sections from `shopify.app.toml` into it, replacing the ones already there.

### 2. Choose the distribution method

Open your app in the Dev Dashboard and, on its Home, use the **Distribution** card. It opens the app's **Distribution** page in the Partner Dashboard. Choose **Public distribution**, click **Select**, then confirm with **Select public distribution**. Shopify requires a distribution method before protected customer data can be requested. See [Select a distribution method](https://shopify.dev/docs/apps/launch/distribution/select-distribution-method).

The choice cannot be changed later. Shopify's documentation says that public distribution also requires registering for the Shopify App Store, which has a one-time fee ([About app distribution](https://shopify.dev/docs/apps/launch/distribution)). This app needs no listing, and neither selecting public distribution nor running the app on a development store asked for the registration or the fee, on an account that has never paid it (#91).

![The Distribution page in the Partner Dashboard, confirming public distribution](docs/images/setup/distribution.png)

### 3. Allow access to protected customer data

Order webhooks and the CSV export need customer names, emails and addresses. See [Work with protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data).

1. In the **Partner Dashboard** (not the Dev Dashboard), go to **Apps**, open your app from the list of Dev Dashboard apps, then **API access requests** → **Protected customer data access**
2. Select **Protected customer data**, and the fields **Name**, **Email** and **Address**, with the reason "App functionality"
3. Save. Step 2 (data protection details) is only needed for App Store review, not for development stores

![Protected customer data access in the Partner Dashboard, with Name, Email and Address selected](docs/images/setup/protected-customer-data.png)

### 4. Run the app on a development store

```bash
npm run dev
```

When asked, create a new development store (any plan works; **Basic** is recommended, and **demo data** gives you products and orders to start with), then open the preview URL and install the app. See [Scaffold an app](https://shopify.dev/docs/apps/build/scaffold-app) (steps 3 and 4) and [Test apps locally](https://shopify.dev/docs/apps/build/cli-for-apps/test-apps-locally).

`npm run dev` applies the scopes (`read_customers`, `read_orders`, `read_products`, `write_orders`) and webhook subscriptions from the sections you copied in step 1; no other setup is needed.

While `npm run dev` runs, a dev preview points the store's app at your machine. Uninstalling the app removes the preview. To install it again, use **Install app** on the **Installs** card of your app in the Dev Dashboard, then restart `npm run dev`. Without the restart, the app opens the placeholder `https://example.com`.

The database needs no setup either. `npm run dev` runs `prisma generate` and `prisma migrate deploy` (`shopify.web.toml`), which create `prisma/dev.sqlite` on the first run and apply new migrations after that. No `.env` file is needed.

### 5. Place a test order

A store created with **demo data** has Shopify's test payment gateway enabled ([Generated test data](https://shopify.dev/docs/apps/build/stores/generated-test-data), which calls it the Bogus payment gateway). Orders paid with it list the gateway as `bogus`. If it is not offered at checkout, activate it under **Settings** → **Payments** ([Shopify's Test payment gateway](https://help.shopify.com/en/manual/checkout-settings/test-orders/payments-test-mode)).

1. Open the online store from the Shopify admin (**Sales channels** → **Online Store** → eye icon). The storefront password is under **Online Store** → **Preferences** ([Dev stores](https://shopify.dev/docs/storefronts/themes/tools/development-stores))
2. Add products to the cart and check out with test data, e.g. email `test.buyer+1@example.com`, a US address
3. Pay with card number `1`, any future expiry date, any 3-digit security code, and name on card `Test payment gateway`

The `orders/create` webhook stores the order while `npm run dev` is running, and it appears in the order list on the app home after you reload the page. Editing the order in the Shopify admin (for example, adding a tag) sends `orders/updated`, which updates the stored copy. To look at the stored rows, open the development database with `npx prisma studio` (tables `Order`, `LineItem`, `Product`).

### 6. Import existing orders

Webhooks only report orders placed or changed after the app was installed. To import the orders placed before that, open the app and click **Sync orders** on the app home. The button is disabled while the sync runs, and then shows how many orders were imported. The sync lists the orders with their `updatedAt` and fetches only those not stored yet or changed since they were stored; each of them goes through the same refetch and write as a webhook ([ADR-0003](docs/adr/0003-refetch-order-via-graphql.md)). So a second sync imports `0` orders if nothing changed. If a sync stops partway, the page says how many orders were imported before it stopped, and running it again continues from there.

The app has `read_orders` without `read_all_orders`, so the Admin API lists only orders created in the last 60 days ([access scopes](https://shopify.dev/docs/api/usage/access-scopes)), and the sync imports only those. `read_all_orders` needs Shopify's approval for an app created under a Partner organization (#21).

### 7. Run the tests

```bash
npm test             # all tests once
npm run test:watch   # re-run on change
npm run typecheck    # regenerates GraphQL types, then runs tsc
```

The tests need no Partner account, store or `.env` file. Each run rebuilds a separate database, `prisma/test.sqlite`, from `prisma/migrations/`, so `prisma/dev.sqlite` is not touched. Shopify's Admin API is replaced with responses captured from a development store (`test/fixtures/`). More on how each layer is tested is in [CONTRIBUTING.md](CONTRIBUTING.md#how-each-layer-is-tested).

## Database design

The database is SQLite, managed with Prisma (`prisma/schema.prisma`). Orders, line items and products are copies of Shopify data. Shopify owns the data ([ADR-0004](docs/adr/0004-sync-tags-to-shopify.md)). The copies are written in four ways:

- **Ingestion:** an `orders/create` or `orders/updated` webhook, or the sync of existing orders ([step 6](#6-import-existing-orders)), refetches the order from the Admin API and writes the order, its line items and their products. An order and its line items are written unless Shopify's `updatedAt` is older than the stored `shopifyUpdatedAt` (an equal value is written: `updatedAt` has one-second precision, so it can carry a later change made in the same second), a guard for two fetches of the same order running at the same time ([ADR-0003](docs/adr/0003-refetch-order-via-graphql.md)). Each product is written the same way, unless the product's own `updatedAt` is older than its stored `shopifyUpdatedAt`: two orders with the same product can be ingested at the same time (#6)
- **Tag edits:** adding or removing an order tag in the app writes to Shopify first, then to the database ([ADR-0004](docs/adr/0004-sync-tags-to-shopify.md))
- **Compliance webhooks:** `customers/redact` empties an order's customer fields, and `shop/redact` deletes an uninstalled shop's data (see [Customer data](#customer-data))
- **Deletion:** the app does not subscribe to Shopify's delete webhooks (`orders/delete`, `products/delete`), so deletions in Shopify are not received (see "Delete behaviour" under [Design choices](#design-choices))

```mermaid
erDiagram
  Order ||--o{ LineItem : "has (delete cascades)"
  Product |o--o{ LineItem : "referenced by (delete sets null)"

  Order {
    String id PK "gid://shopify/Order/..."
    String shop
    String name "#1001"
    Int number
    BigInt totalPriceMinor "minor unit: 11.99 USD = 1199"
    String currencyCode "ISO 4217"
    String paymentGateways "JSON array"
    String customerEmail "nullable"
    String customerFullName "nullable"
    String customerAddress "nullable"
    Boolean customerRedacted "set by customers/redact"
    String tags "JSON array"
    DateTime shopifyCreatedAt
    DateTime shopifyUpdatedAt
  }
  LineItem {
    String id PK "gid://shopify/LineItem/..."
    String orderId FK
    String productId FK "nullable"
    String title "title at purchase"
    Int quantity
  }
  Product {
    String id PK "gid://shopify/Product/..."
    String shop
    String title
    String tags "JSON array"
    DateTime shopifyUpdatedAt
  }
```

### Tables

| Table | Holds | Notes |
|---|---|---|
| `Order` | One row per Shopify order, scoped to a shop | `customerAddress` is one formatted string (shipping, falling back to billing). `customers/redact` sets `customerEmail`, `customerFullName` and `customerAddress` to null and `customerRedacted` to true, and later ingestions keep the three fields null (see [Customer data](#customer-data)) |
| `LineItem` | One row per line item of an order | `productId` is null when the line item had no product the last time its order was ingested: a custom item, or a product already deleted in Shopify |
| `Product` | One row per product seen on an ingested order, scoped to a shop | Title and tags as fetched with an order containing the product, written by each ingestion of such an order. `shopifyUpdatedAt` is the product's `updatedAt` in Shopify, so when two such ingestions run at the same time, the older fetch is not written over the newer one. `app/uninstalled` and `shop/redact` delete a shop's products |
| `Session` | Shopify OAuth sessions, from the app template | Unchanged from the template; not related to the other tables, so not in the diagram |

### Design choices

**Shopify GIDs are the primary keys** (`gid://shopify/Order/...`, `.../LineItem/...`, `.../Product/...`).

- The webhook carries the GID (`admin_graphql_api_id`), and the GraphQL refetch ([ADR-0003](docs/adr/0003-refetch-order-via-graphql.md)) takes it as is
- Upserting the same object twice hits the same row, so a repeated webhook creates no duplicate
- No mapping between an app ID and a Shopify ID is needed

**`Product` is a separate table.** A product is shared by many line items, across orders, and the CSV needs the product's own title and tags rather than what the line item carries (see [Interpretation of the task](#interpretation-of-the-task)). Storing them once per product means every line item of that product shows the same values. They are refreshed whenever an order containing the product is ingested, not when the product itself changes. `LineItem.title` keeps the title at purchase as the fallback when the line item has no product.

**Delete behaviour.** The app subscribes to `orders/create`, `orders/updated` and `app/uninstalled`, and to the compliance webhooks `customers/data_request`, `customers/redact` and `shop/redact`. None of them reports a deleted order or product, so a deletion in Shopify does not delete rows here. `app/uninstalled` deletes the shop's orders, line items, products and sessions, on every delivery of it whose signed payload names that shop (see [Customer data](#customer-data)). `shop/redact`, which Shopify sends 48 hours after the uninstall, deletes the shop's orders, line items and products again, so anything written after `app/uninstalled` is removed too. If the app was installed again in those 48 hours, `shop/redact` deletes nothing. What `customers/redact` changes is under [Customer data](#customer-data).

A product deleted in Shopify shows up only on orders ingested again afterwards. For a deleted product the refetch returns no product (`product: null`, confirmed with a captured response in #6), so `productId` becomes null and the CSV falls back to the title at purchase. Other orders containing that product keep showing its stored title and tags.

The foreign keys define what happens when a row is deleted in the app's database. Deleting an order deletes its line items (`onDelete: Cascade`). Deleting a product keeps its line items and sets their `productId` to null (`onDelete: SetNull`), so the order and the title at purchase stay in the CSV. `app/uninstalled` and `shop/redact` delete a shop's orders (their line items go with them) and its products.

**Tags and payment gateways are JSON arrays in String columns**, e.g. `["VIP","wholesale"]`. SQLite has no array type. JSON keeps a value unambiguous whatever characters it contains (a comma-separated string would not), and adding or removing one tag is an array operation. Filtering by tag in SQL is not needed by the current requirements.

**The order total is an integer in the currency's minor unit** (`totalPriceMinor`: 11.99 USD → `1199`, 1500 JPY → `1500`), stored with `currencyCode`. A String column cannot be summed with Prisma's `_sum`, and a Prisma `Decimal` on SQLite is stored as a floating-point REAL, so the total is kept as an integer. Totals across orders are summed per currency. The column is a `BigInt`, which Prisma returns as a JavaScript `bigint`. A 32-bit `Int` would cap one order at 2,147,483,647 minor units (about 21 million USD, or 2.1 million in a 3-decimal currency such as KWD), and one larger order would make every query that returns its row fail.

**Indexes.** `Order(shop, shopifyCreatedAt)` serves the order list (a shop's orders, newest first). `LineItem(orderId)` and `LineItem(productId)` are indexed because SQLite does not index foreign keys on its own. `Product(shop)` is not a foreign key index (`shop` is a plain column). It serves deleting a shop's products on `app/uninstalled` and `shop/redact`.

### Customer data

The app stores three customer fields, on `Order` only: `customerEmail`, `customerFullName` and `customerAddress`. They are copied from the merchant's own orders in Shopify. No other table holds customer data, and the app does not store the Shopify customer ID.

Shopify requires every public app, listed on the App Store or not, to handle three compliance webhooks. The app subscribes to them in `shopify.app.toml` (`compliance_topics`). Each route verifies the HMAC signature and returns 401 for an invalid one. The shop comes from the `X-Shopify-Shop-Domain` header, which the signature does not cover, so the two redaction routes also return 401 when the signed payload's `shop_domain` names another shop. Otherwise each route responds 200 after doing the following:

| Topic | When Shopify sends it | What the app does |
|---|---|---|
| `customers/redact` | 10 days after a merchant requests the deletion of a customer's data | Sets the three customer fields to null on the orders listed in `orders_to_redact`, within the shop, and sets `customerRedacted`. A later ingestion of such an order (for example `orders/updated` after a refund) keeps the three fields null, whatever Shopify returns. The order, its line items and tags stay, as they do in Shopify. Listed orders the app never stored are skipped |
| `shop/redact` | 48 hours after the app is uninstalled | Deletes the shop's orders, line items and products, as `app/uninstalled` does. If the shop has a session again (the app was installed again in those 48 hours), it deletes nothing: `app/uninstalled` deletes the sessions, and the data then belongs to the new install. Shopify's documentation does not say whether a reinstall cancels `shop/redact` |
| `customers/data_request` | When a customer asks a merchant for their data | Nothing beyond logging the topic and shop; customer details are not logged. The app sends nothing to the customer. The stored fields are copies of the merchant's own orders, so the merchant already has them in the Shopify admin. The app's order list shows the name and email, and the CSV export shows all three |

Orders are matched by ID only (`orders_to_redact`, numeric IDs turned into GIDs), because the app does not store the customer ID. Customer data on an order not in that list stays. The routes do not need a session, so redaction also runs after the app was uninstalled.

`app/uninstalled` is not a compliance webhook, but it deletes the same data and has the same check: it returns 401 and deletes nothing unless the signed payload's `myshopify_domain` is the shop in the header. A real delivery captured from the development store has the shop's domain in that field, although Shopify's documented sample has null.

To check the routes by hand, run the app (`npm run dev`) and send Shopify's sample payloads with `npx shopify app webhook trigger --topic customers/data_request` (or `customers/redact`, `shop/redact`), giving the app's local address and client secret when asked. `customers/data_request` returns 200. The two redaction routes return 401 for the samples: their `shop_domain` is the placeholder `{shop}.myshopify.com`, which does not match the shop in the header. The redaction itself is covered by the route tests (`test/routes/webhooks.customers.redact.test.ts`, `test/routes/webhooks.shop.redact.test.ts`).

`app/uninstalled` also rejects its sample, which has `"myshopify_domain": null`, so a 401 with `--topic app/uninstalled` is expected. `npm run dev` sends this kind of sample to the route by itself when the app's client ID differs from the previous run, which includes the first run and a run after `config:link`. The CLI then prints `APP_UNINSTALLED webhook delivery failed` and the local data stays.

## Interpretation of the task

The task leaves some details open. These are the readings this app follows (decided in #18).

### CSV rows: one row per line item

Each row is one line item. Order columns (order id, number, total, customer, tags, …) repeat on every row of the same order. A line item with quantity `0`, which was removed by an order edit or refunded, has no row, so the rows match the order as it is now.

This keeps one product title and one set of product tags per row, so the file can be filtered and pivoted in a spreadsheet.

> **Note:** because order columns repeat, summing *Total price* over all rows counts an order once per line item. Sum distinct orders instead.

### Product title: the product's own title, falling back to the title at purchase

*Product title* is the product's own title (`Product.title`), fetched and refreshed the same way as the product tags below. If the line item has no product (`productId` is null; see the `LineItem` row under [Database design](#database-design)), the title recorded on the line item at purchase (`LineItem.title`) is used.

The task lists *Product title* among the fields "not in order/id/.json". The order already carries the title at purchase on each line item, so the field asked for is read as the product's own title.

### Product tags: as fetched with an order containing the product

Product tags are fetched together with the order whenever an order is ingested (`orders/create`, `orders/updated`, or a sync), and stored once per product. A sync ingests only orders not stored yet or changed since they were stored, so it does not refresh the tags of products on unchanged orders. Each ingestion of an order containing the product writes them, unless the stored product is newer (see the `Product` row under [Database design](#database-design)), so every line item linked to the product shows the same stored tags, not the tags as of its own order's ingestion. A line item with no product has an empty *Product tags* cell: unlike the title, no tags are recorded at purchase. The app does not update products from product webhooks or events, so a tag change on a product shows up the next time an order containing it is ingested. A product deleted in Shopify keeps its stored title and tags on orders that are not ingested again.

### Customer address: shipping address, falling back to billing

*Customer address* is the order's shipping address. Orders without one (for example, digital goods) use the billing address.
The address lines from Shopify (`formatted`, without the name) are joined with `, `, e.g. `123 Test Street, San Francisco CA 94103, United States`.

### Customer name and email

*Customer full name* is the order's customer, first and last name. *Customer email* is the email on the order. Both can be empty, for example for an order created in the admin without choosing a customer. Reading the customer requires the `read_customers` scope (#1).

### Total price and quantity: current values, in the shop's currency

*Total price* is the order's current total (`currentTotalPriceSet`) in the shop's currency: after refunds, returns and order edits, including taxes and discounts. A line item's quantity is its current quantity (`currentQuantity`), so a line item removed by an order edit is expected to stay with quantity `0` (read from the API reference, not yet confirmed with a captured response). Both match the order as it is now in the Shopify admin. Decided in #1.

### CSV format

| Item | Format |
|---|---|
| Columns | The nine fields of the CSV template, in order, followed by *Product title* and *Product tags* |
| Order id | The numeric ID, e.g. `6663058751643` from `gid://shopify/Order/6663058751643`. It is the `id` in `order/id.json` and in the Shopify admin's order URL |
| Order number | The number without the shop's prefix, e.g. `1006` for `#1006` |
| Total price | A plain decimal in the shop's currency, without a symbol: `11.99`, `1500` (JPY), `1.234` (KWD) |
| Multiple values in one cell (tags, payment gateways) | Joined with `, ` and quoted |
| Dates | ISO 8601 in UTC, e.g. `2026-11-02T13:05:00Z`. The shop's time zone is not stored, and UTC does not depend on the server's |
| Encoding | UTF-8 with a BOM, so Excel opens non-ASCII names and addresses correctly |
| Line endings | CRLF (RFC 4180) |
| Escaping | RFC 4180 (values containing `,`, `"` or line breaks are quoted; `"` is doubled). Values containing `;` are quoted too, for a reader that accepts both `,` and `;` as separators |
| Formula cells | A text cell (payment gateway, customer fields, tags, product title, product tags) starting with `=`, `+`, `-`, `@`, tab, carriage return, line feed or a full-width `＝`, `＋`, `－`, `＠` gets a leading `'`, because a spreadsheet can run such a cell as a formula ([OWASP](https://owasp.org/www-community/attacks/CSV_Injection)). The same characters also get a `'` when they follow `;` or a line break inside the cell, with or without a `"` in between (`x;=1+1` becomes `x;'=1+1`). Where `;` is the spreadsheet's separator, commas do not split a line, so a value is cut at each `;` and line break, and quoting does not prevent it. A merchant with a comma separator sees that `'` in the value. Numeric and generated columns (order id, order number, total price, created at) never do, so a negative total stays a number |

Merchants download the file with the **Export CSV** button above the order list, which is shown once the shop has orders. The file has all of the shop's orders, newest first, with an order's rows in a stable order, and is built from the app's database, so an export makes no Shopify API call. An order with no line items left still gets one row, with the product columns empty.

[`samples/orders.csv`](samples/orders.csv) is a sample of the file. Its orders are made-up test data, written by the same code as the export (`buildOrdersCsv`) rather than downloaded from a store, so that it can show cases such as commas, quotes and formula cells together. `test/domain/orders-csv-sample.test.ts` holds those orders and fails if the file no longer matches what the export writes.

### Distribution: public

The app uses public distribution, so any store can install it. It is not listed on the Shopify App Store.

### Order list columns

Order number, created at, customer, email, total, payment gateway, tags. These are the CSV fields needed to tell orders apart at a glance; the full set is in the CSV.

Orders are listed newest first, 50 per page, from the app's database, so a page view makes no Shopify API call. *Created at* is shown in the browser's time zone: the app does not store the shop's time zone, so it can differ from the Shopify admin when the two zones differ. *Total* is shown in the order's stored currency, formatted in English (`$11.99`, `¥1,500`).

### Order tags

Merchants add a tag from the order's row in the list. The tag is checked before it is sent to Shopify:

| Input | Result | Why |
|---|---|---|
| Surrounding whitespace | Trimmed | |
| Empty | Rejected | |
| Contains a comma | Rejected | `tagsAdd` splits `a,b` into two tags |
| Over 55 characters | Rejected | Shopify answers `Order tags is invalid` from 56. An emoji counts as one character |
| The order already has it, in any case | Rejected | `tagsAdd` treats `vip` as an existing `VIP`, and does nothing |

The limit and the behaviour above were measured on the development store (Admin API 2026-10, #3); the documentation does not state them. The check uses the stored copy of the tags, which can be behind Shopify. A tag added in the Shopify admin a moment ago may not be caught, and `tagsAdd` then does nothing for it. A duplicate found in the stored copy is checked again against a refetch of the order, so a tag removed in the Shopify admin a moment ago can be added back.

Merchants remove a tag with the button next to it. The tag is sent exactly as it is stored, because `tagsRemove` matches case-sensitively and ignores a tag it does not find, without an error. It does not go through the checks above, so a tag added elsewhere that they would reject can still be removed. If the response still has the tag, in any case, the merchant gets an error, and the order is stored again so that trying again uses the tag as Shopify has it.

After a tag edit, the app refetches the order and stores it whole, the same way as a webhook ([ADR-0003](docs/adr/0003-refetch-order-via-graphql.md)). So the stored `updatedAt` always describes all of the order's columns, and an edit that changed nothing in Shopify, which sends no `orders/updated`, still brings the copy up to date. A webhook's fetch from before the edit is older, so it is skipped when it finishes late. If the refetch fails, the merchant is still told the edit worked, because it reached Shopify; the `orders/updated` for it repairs the copy.

## Implementation choices

Design decisions are recorded as Architecture Decision Records in [docs/adr/](docs/adr/README.md). Each ADR holds the options considered and the full reasoning. This table is a summary.

| ADR | Decision | Why |
|---|---|---|
| [0001](docs/adr/0001-react-router-template.md) | Build on the React Router v7 app template | The task prefers Node.js or Remix. React Router v7 is Remix's successor and Shopify's current template, while the Remix package gets only critical security fixes |
| [0002](docs/adr/0002-polaris-web-components.md) | Build the UI with Polaris Web Components | Polaris React receives no more updates, and the template already uses Web Components |
| [0003](docs/adr/0003-refetch-order-via-graphql.md) | Use webhooks as triggers and refetch each order via GraphQL | The webhook payload has no product tags, so a fetch is needed anyway. Refetching the whole order leaves one data source and one mapping |
| [0004](docs/adr/0004-sync-tags-to-shopify.md) | Write order tags to Shopify, not only to the app's database | Shopify owns the data. A tag stored only in the app would disappear on the next refetch of the order |
| [0005](docs/adr/0005-process-webhooks-synchronously.md) | Process webhooks within the request, not from a queue | One delivery takes about 0.5 s against Shopify's 5-second limit, and reviewers can run the app without a worker or Redis. Production would use a queue |
| [0006](docs/adr/0006-tdd.md) | Develop with TDD and merge pull requests with merge commits | The core logic is easy to test first, and the commits show how the work was done. The UI has only thin tests, and Shopify configuration is checked by hand |

## Development process

Requirements, their issues and the test naming are in [docs/requirements.md](docs/requirements.md). The rules are in three documents:

- **Issue-first TDD ([CONTRIBUTING.md](CONTRIBUTING.md)):** a change starts from an issue with a test list. It is built test-first on its own branch and reaches `main` through a pull request that records what was run, the risks and how to roll back
- **Code review ([REVIEW.md](REVIEW.md)):** a pull request is reviewed by an agent that did not write the code, with one fix-and-verify round. Merging is the author's decision
- **Security review ([SECURITY_REVIEW.md](SECURITY_REVIEW.md)):** required when a pull request touches authentication, webhooks, customer data, Shopify writes, scopes, exports or dependencies

### Reading the commit history

Pull requests are merged with merge commits, and squash and rebase merges are disabled, so the commits of each change stay in the history.

```bash
git log --first-parent --oneline main                       # one merge per pull request, after the first setup commits
git log --no-merges --oneline --reverse --grep='(#3)' main  # the commits of one issue, oldest first
```

Within an issue, a `test:` commit adds a failing test, a `feat:` or `fix:` commit makes it pass, and a `refactor:` commit cleans up. Each message ends with its issue number. Tests can fail at commits inside a branch, so only the merge commits on `main` are expected to pass.
Known exceptions are listed in [PR #90](https://github.com/rukiita/shopify_test/pull/90) under "Commit history". The setup commits before the first pull request, and the `test:` commits of #90 itself, which state existing behaviour, are also outside this pattern.

## Known limitations / Production considerations

- The app has not been submitted to the Shopify App Store. The compliance webhooks that Shopify requires are implemented (see [Customer data](#customer-data)), but step 2 of the protected customer data request (data protection details) and App Store review are not done
- The repository has no Dockerfile or other deployment configuration. The app runs locally with `npm run dev`
- There is no CI: the repository has no GitHub Actions workflows, so tests, code reviews and security reviews run locally
- `read_customers` was added after the first install (#1). A store installed before that has it only once the merchant opens the app and approves the new scope. Until then the order query is denied, and order webhooks for that store fail and are retried
- The CSV export reads all of a shop's orders and builds the file in memory within one request, which has not been measured on a large store. The read shares the one SQLite connection, and building the file holds the Node process, so order webhooks for every shop wait meanwhile and can pass Shopify's 5-second limit, which leaves them to Shopify's retries. For large stores, stream the rows or build the file in a background job (#5)
- The CSV has no currency column. *Total price* is in the currency the shop had when the order was last ingested, so the column can mix currencies after a shop changes its currency (#5)
- *Order id* is a plain number of 13 or more digits. Excel is expected to display it in scientific notation, and saving the file from Excel can then write the rounded form (not checked in Excel yet). Keep the original file, or import the column as text (#5)
- The `'` prefix stops a formula when the file is opened, but OWASP warns that Excel may strip quotes and escape characters after a file is saved and reopened (#5)
- Only the first 250 line items of an order are stored (one GraphQL page, `lineItems(first: 250)`). Line items beyond that are not stored and not in the CSV (#1)
- Order webhooks are processed within the request: the order is fetched and stored before the app responds ([ADR-0005](docs/adr/0005-process-webhooks-synchronously.md)). One delivery takes about 0.5 s against Shopify's 5-second limit. Database writes run one at a time over one SQLite connection, so deliveries that arrive at the same time wait for each other (#77). A burst of more than about 75 large or 170 small orders at once (measured on the database write alone; through the route it may be fewer) fails in part and is left to Shopify's retries. In production, process webhooks from a queue, use a database that allows concurrent writes, and reconcile orders whose deliveries were dropped. No reconciliation job is planned; the sync ([step 6](#6-import-existing-orders)) can be run by hand and imports the orders from the last 60 days that are missing or changed
- `customers/redact` marks only orders the app has already stored. An order in `orders_to_redact` that is stored later (for example by the sync of existing orders) gets its customer fields as Shopify returns them then. `app/uninstalled` and `shop/redact` delete the shop's orders, and `customerRedacted` goes with them, so after a reinstall a sync can store the customer fields of a redacted order if Shopify returns them (#65, #98)
- `customers/data_request` only logs the request. Shopify asks apps to provide the requested data to the store owner directly, within 30 days ([privacy law compliance](https://shopify.dev/docs/apps/build/compliance/privacy-law-compliance)). In production, provide the stored data to the store owner within that time (#98)
- Access tokens and customer data are stored unencrypted in SQLite (`Session`, `Order`). The app uses names, emails and addresses, which makes it level 2 under Shopify's protected customer data requirements, and those include encrypting data at rest ([protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)). In production, encrypt them at rest (#98)
- An `app/uninstalled` delivery fails when the shop's offline token has expired, so the shop's data is not deleted. `authenticate.webhook` refreshes an expired token before the route's code runs. In a check on a development store, the session's `expires` was set one hour into the past, with the refresh token's own expiry still months away, and the app was uninstalled. The three deliveries seen returned 500, `Received APP_UNINSTALLED` was not logged, and the `Session` row was still there 5 minutes later. An uninstall earlier the same day, with a session that had not expired, returned 200 and deleted the rows. Not confirmed: that the refresh is the cause (the app logs nothing for it, so this is read from the library's code and the difference between the two uninstalls), the result of Shopify's remaining retries, a token that expired by itself, and `shop/redact` and `customers/redact` in this state, which go through the same code and are expected to fail the same way while the session remains. In production, verify the signature in these routes without loading the session (#95)
- A signed `app/uninstalled` delivery can be sent again. The signature covers only the body, and the app does not record which deliveries it has handled, so a past delivery's body and signature, resent after a reinstall, delete the new install's orders, products and offline session. Checking the shop in the signed payload (#94) does not stop this, because the body names the same shop. The fix suggested for #74 below does not cover it either: `triggeredAt` comes from the `X-Shopify-Triggered-At` header, which the signature does not cover, so the sender can set it. This was read from the code, not reproduced, and no fix has been chosen (#98)
- `shop/redact` cannot tell a missed `app/uninstalled` from a reinstall. `app/uninstalled` deletes the shop's sessions, so the route treats any remaining session as a reinstall: it responds 200 and deletes nothing. A session also remains when `app/uninstalled` never succeeded, for example after an outage longer than Shopify's retry window, and then the shop's orders with their customer data stay. With an expired token (#95), `shop/redact` is expected to fail before it reaches this check, and the data stays too. `Session` has no creation time that could tell the two cases apart. In production, store the install time and compare it with the delivery (#97)
- A late `app/uninstalled` retry can delete a reinstalled shop's data. If the first delivery fails and the merchant reinstalls within Shopify's retry window (8 retries over 4 hours), the retry deletes the new install's orders, products and offline session, and order webhooks then store nothing until the merchant opens the app again. In production, store the install time and compare it with the delivery's `triggeredAt` (#74)
- `app/uninstalled` depends on `myshopify_domain`, which has been checked on real deliveries from one development store only, while Shopify's documented sample has null. A genuine delivery with null or another value would return 401 and log `Rejected APP_UNINSTALLED webhook`. Shopify would retry it and give up (8 retries over 4 hours), so the orders with their customer data and the session would stay. `shop/redact` would then delete nothing 48 hours later, because it treats the session as a reinstall. In production, alert on that log line and check the field on more stores (#94)
- The form for adding a tag has no `method` or `action`, so submitting it before the page has hydrated is expected to send a plain GET to `/app?tag=...`. That loses the `shop` and `host` parameters of the embedded app, so authentication can redirect or fail. No tag is written. This was read from the code, not reproduced. In production, disable the controls until hydration (#84, #70)
- `updatedAt` has one-second precision, and a fetch with an equal value is written, because it can carry a later change made in the same second. So a webhook's fetch from before a tag edit, in the same second as the edit, can undo the edit in the stored copy if it is written last. The copy stays that way until the order next changes, and a sync does not repair it, because it skips orders with the same `updatedAt` (#3)
- The sync of existing orders runs within one request, one order at a time: it lists orders 250 per page, then fetches and writes each new or changed order as a webhook would. Its time grows with the number of orders to import (the same fetch and write take about 0.5 s per webhook delivery; the sync itself has not been measured on a large store). A request that Shopify answers with 429 or 503 is tried up to three times. The GraphQL rate limit is reported as a `THROTTLED` error with status 200, which is not retried: the sync stops, the orders imported before it stay, and running it again continues with the orders not imported yet. Fetching several orders at once is not done (#70). For large stores, run it as a background job with a bulk operation instead (#21)

### Dependency audit

The app was scaffolded from [`shopify-app-template-react-router`](https://github.com/Shopify/shopify-app-template-react-router) version **2026.10.09**, and keeps the dependency versions it pins.

`npm audit` on a clean install (`npm ci`, 2026-10-31) reports 39 issues (26 high, 13 moderate). Most come from development-only tools (ESLint, GraphQL codegen, the Prisma CLI). Limited to production dependencies (`npm audit --omit=dev`), there are 6 (4 high, 2 moderate), from two root causes:

| Package | Reached through | Issue | Why the risk is low here |
|---|---|---|---|
| `deepmerge-ts` | `prisma` → `@prisma/config` | Stack exhaustion when merging recursive objects | Used when Prisma loads its configuration, not on request data |
| `minimatch` | `@react-router/fs-routes` | Denial of service through globparts amplification ([GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249)) | Used to match route file names at build time, not on request data |

Fixing `deepmerge-ts` requires a major upgrade (Prisma 7), and fixing the development-only issues requires newer ESLint / TypeScript ESLint. These upgrades would diverge from the template and risk the database work in this task, so they are deferred. `npm audit` reports no fix for `minimatch`: `@react-router/fs-routes` depends on version 9, and the advisory is fixed in 11.0.1. In production, make these upgrades, re-run `npm audit`, and check `minimatch` again.
