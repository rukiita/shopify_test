# Shopify Order Tags

A Shopify app that captures orders through webhooks, lets merchants add and remove order tags, and exports orders to CSV.

> Sections marked _(to be written)_ are filled in as the work progresses. Each one names the step and issue that completes it.

## Contents

- [Features](#features)
- [Screenshots](#screenshots)
- [Installation and configuration](#installation-and-configuration)
- [Database design](#database-design)
- [Interpretation of the task](#interpretation-of-the-task)
- [Implementation choices](#implementation-choices)
- [Development process](#development-process)
- [Known limitations / Production considerations](#known-limitations--production-considerations)

## Features

_(to be written — Step 8, #9)_

## Screenshots

_(to be written — Step 8, #9)_

## Installation and configuration

> **Draft.** Written while setting up the author's environment (#19). It will be verified step by step in a fresh environment and finalised in Step 8 (#11). Shopify admin labels are given in English and will be checked against the English admin then.

### Prerequisites

- Node.js 22.12 or later
- A Shopify Partner account with an organization ([partners.shopify.com](https://partners.shopify.com)). Without an organization, Shopify CLI stops with "No Organization found"

Shopify CLI is a project dependency (`@shopify/cli` in `devDependencies`), so no global install is needed. Run it through the npm scripts or `npx shopify`.

### 1. Install dependencies and connect your own app

```bash
npm install
npm run config:link   # create or select an app in your own organization
```

`shopify.app.toml` contains the author's `client_id`. `config:link` replaces it with an app in your organization.

### 2. Choose the distribution method

In the Partner Dashboard, open your app and choose **Public** distribution. Shopify requires a distribution method before protected customer data can be requested. The choice cannot be changed later. The app does not need to be listed on the App Store.

### 3. Allow access to protected customer data

Order webhooks and the CSV export need customer names, emails and addresses.

1. In the **Partner Dashboard** (not the Dev Dashboard), go to **Apps**, open your app from the list of Dev Dashboard apps, then **API access requests** → **Protected customer data access**
2. Select **Protected customer data**, and the fields **Name**, **Email** and **Address**, with the reason "App functionality"
3. Save. Step 2 (data protection details) is only needed for App Store review, not for development stores

### 4. Run the app on a development store

```bash
npm run dev
```

When asked, create a new development store (any plan works; **Basic** is recommended, and **demo data** gives you products and orders to start with), then open the preview URL and install the app.

Scopes (`read_orders`, `read_products`, `write_orders`) and webhook subscriptions are declared in `shopify.app.toml` and applied by `npm run dev`; no manual setup is needed.

### 5. Place a test order

Development stores use the Bogus Gateway for payments by default.

1. Open the online store from the Shopify admin (**Sales channels** → **Online Store** → eye icon). The storefront password is under **Online Store** → **Preferences**
2. Add products to the cart and check out with test data, e.g. email `test.buyer+1@example.com`, a US address
3. Pay with card number `1`, any future expiry date, any 3-digit security code, and name on card `Bogus Gateway`

_(Database setup, running the tests, and the remaining steps are added in Step 8.)_

## Database design

_(to be written — Step 2, #8)_

## Interpretation of the task

The task leaves some details open. These are the readings this app follows (decided in #18).
The app uses public distribution, so any store can install it. It is not listed on the Shopify App Store.

### CSV rows: one row per line item

Each row is one line item. Order columns (order id, number, total, customer, tags, …) repeat on every row of the same order.

This keeps one product title and one set of product tags per row, so the file can be filtered and pivoted in a spreadsheet.

> **Note:** because order columns repeat, summing *Total price* over all rows counts an order once per line item. Sum distinct orders instead.

### Product title: the current title, falling back to the title at purchase

*Product title* is the product's current title (`Product.title`). If the product has been deleted, the title recorded on the line item at purchase (`LineItem.title`) is used.

The task lists *Product title* among the fields "not in order/id/.json". The order already carries the title at purchase on each line item, so the field asked for is read as the product's own title.

### Product tags: as of the last time the order was ingested

Product tags are fetched together with the order whenever the order is ingested (`orders/create`, `orders/updated`, or a sync). The app does not subscribe to `products/update`, so a tag change on a product shows up the next time one of its orders changes.

### Customer address: shipping address, falling back to billing

*Customer address* is the order's shipping address. Orders without one (for example, digital goods) use the billing address.

### CSV format

| Item | Format |
|---|---|
| Columns | The nine fields of the CSV template, in order, followed by *Product title* and *Product tags* |
| Multiple values in one cell (tags, payment gateways) | Joined with `, ` and quoted |
| Dates | ISO 8601 with offset, e.g. `2026-10-31T10:00:00+09:00` |
| Encoding | UTF-8 with a BOM, so Excel opens non-ASCII names and addresses correctly |
| Escaping | RFC 4180 (values containing `,`, `"` or line breaks are quoted; `"` is doubled) |

### Distribution: public

The app uses public distribution, so any store can install it. It is not listed on the Shopify App Store.

### Order list columns

Order number, created at, customer, email, total, payment gateway, tags. These are the CSV fields needed to tell orders apart at a glance; the full set is in the CSV.

## Implementation choices

Design decisions are recorded as Architecture Decision Records in [docs/adr/](docs/adr/README.md).

_(summary to be written — Step 8, #12)_

## Development process

This repository is developed issue-first with TDD. See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/requirements.md](docs/requirements.md).

_(to be expanded — Step 8)_

## Known limitations / Production considerations

_(to be written — Step 8, #12)_
