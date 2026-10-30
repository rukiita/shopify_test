### Purpose
Define the database schema that BE-1 to BE-6 build on, so schema work has an issue to close (SUB-1: every PR maps to an issue).

### Tasks
- [ ] Add `Order`, `LineItem` and `Product` to `prisma/schema.prisma`
  - `Order`: Shopify GID as primary key, shop, name, order number, total price, currency, payment gateways, customer email / full name / address, tags, Shopify created/updated timestamps
  - `LineItem`: order (FK, cascade delete), product (nullable), title, quantity
  - `Product`: Shopify GID, shop, title, tags
- [ ] Index on `Order(shop, shopifyCreatedAt)` for the list ordering
- [ ] Decide how tags are stored (SQLite has no array type: JSON or a delimited string) and note it for SUB-2
- [ ] Run `npx prisma migrate dev` and commit the migration
- [ ] Confirm the test database picks up the schema (#20)

### Done when
The migration applies cleanly, and a test can write and read an Order with LineItems against the test database
