# Interpretation of the task

The reasoning behind each reading of the task. The [README](../README.md#interpretation-of-the-task) has a summary.

The task leaves some details open. These are the readings this app follows (decided in #18).

## CSV rows: one row per line item

Each row is one line item. Order columns (order id, number, total, customer, tags, …) repeat on every row of the same order. A line item with quantity `0`, which was removed by an order edit or refunded, has no row, so the rows match the order as it is now.

This keeps one product title and one set of product tags per row, so the file can be filtered and pivoted in a spreadsheet.

> **Note:** because order columns repeat, summing *Total price* over all rows counts an order once per line item. Sum distinct orders instead.

## Product title: the product's own title, falling back to the title at purchase

*Product title* is the product's own title (`Product.title`), fetched and refreshed the same way as the product tags below. If the line item has no product (`productId` is null; see the `LineItem` row under [Database design](database.md#database-design)), the title recorded on the line item at purchase (`LineItem.title`) is used.

The task lists *Product title* among the fields "not in order/id/.json". The order already carries the title at purchase on each line item, so the field asked for is read as the product's own title.

## Product tags: as fetched with an order containing the product

Product tags are fetched together with the order whenever an order is ingested (`orders/create`, `orders/updated`, or a sync), and stored once per product. A sync ingests only orders not stored yet or changed since they were stored, so it does not refresh the tags of products on unchanged orders. Each ingestion of an order containing the product writes them, unless the stored product is newer (see the `Product` row under [Database design](database.md#database-design)), so every line item linked to the product shows the same stored tags, not the tags as of its own order's ingestion. A line item with no product has an empty *Product tags* cell: unlike the title, no tags are recorded at purchase. The app does not update products from product webhooks or events, so a tag change on a product shows up the next time an order containing it is ingested. A product deleted in Shopify keeps its stored title and tags on orders that are not ingested again.

## Customer address: shipping address, falling back to billing

*Customer address* is the order's shipping address. Orders without one (for example, digital goods) use the billing address.
The address lines from Shopify (`formatted`, without the name) are joined with `, `, e.g. `123 Test Street, San Francisco CA 94103, United States`.

## Customer name and email

*Customer full name* is the order's customer, first and last name. *Customer email* is the email on the order. Both can be empty, for example for an order created in the admin without choosing a customer. Reading the customer requires the `read_customers` scope (#1).

## Total price and quantity: current values, in the shop's currency

*Total price* is the order's current total (`currentTotalPriceSet`) in the shop's currency: after refunds, returns and order edits, including taxes and discounts. A line item's quantity is its current quantity (`currentQuantity`), so a line item removed by an order edit is expected to stay with quantity `0` (read from the API reference, not yet confirmed with a captured response). Both match the order as it is now in the Shopify admin. Decided in #1.

## CSV format

The format table is in the [README](../README.md#csv).

Merchants download the file with the **Export CSV** button above the order list, which is shown once the shop has orders. The file has all of the shop's orders, newest first, with an order's rows in a stable order, and is built from the app's database, so an export makes no Shopify API call. An order with no line items left still gets one row, with the product columns empty.

[`samples/orders.csv`](../samples/orders.csv) is a sample of the file. Its orders are made-up test data, written by the same code as the export (`buildOrdersCsv`) rather than downloaded from a store, so that it can show cases such as commas, quotes and formula cells together. `test/domain/orders-csv-sample.test.ts` holds those orders and fails if the file no longer matches what the export writes.

## Distribution: public

The app uses public distribution, so any store can install it. It is not listed on the Shopify App Store.

## Order list columns

Order number, created at, customer, email, total, payment gateway, tags. These are the CSV fields needed to tell orders apart at a glance; the full set is in the CSV.

Orders are listed newest first, 50 per page, from the app's database, so a page view makes no Shopify API call. *Created at* is shown in the browser's time zone: the app does not store the shop's time zone, so it can differ from the Shopify admin when the two zones differ. *Total* is shown in the order's stored currency, formatted in English (`$11.99`, `¥1,500`).

## Order tags

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

After a tag edit, the app refetches the order and stores it whole, the same way as a webhook ([ADR-0003](adr/0003-refetch-order-via-graphql.md)). So the stored `updatedAt` always describes all of the order's columns, and an edit that changed nothing in Shopify, which sends no `orders/updated`, still brings the copy up to date. A webhook's fetch from before the edit is older, so it is skipped when it finishes late. If the refetch fails, the merchant is still told the edit worked, because it reached Shopify; the `orders/updated` for it repairs the copy.
