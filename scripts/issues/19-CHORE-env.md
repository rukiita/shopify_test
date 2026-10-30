### Purpose
Install the app on a development store so that order webhooks can be received.

### Tasks
- [ ] Create a Partner account and a development store
- [ ] Run `shopify app init --template=https://github.com/Shopify/shopify-app-template-react-router` in a separate folder and move the generated files into the repository (do not overwrite `docs/` or `.github/`)
- [ ] Scopes: `read_orders`, `read_products` (plus `write_orders` depending on ADR-0004)
- [ ] Protected customer data: select the purpose and the fields used (name, email, address). Note where the setting lives, for the README
- [ ] Install with `shopify app dev`
- [ ] Create test orders with the Bogus Gateway (including multiple line items and tagged products)

### Done when
Subscribing to `orders/create` succeeds, and creating a test order sends a request to the app
