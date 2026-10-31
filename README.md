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

_(to be written — Step 8, #11)_

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
