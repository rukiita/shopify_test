import type { ActionFunctionArgs } from "react-router";
import { ingestOrder } from "../lib/ingest-order.server";
import { authenticate } from "../shopify.server";

// orders/create and orders/updated (shopify.app.toml). The payload is only a
// trigger: the order is refetched via GraphQL (ADR-0003).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);

  // No offline session: the app was uninstalled, so there is nothing to fetch with.
  if (!admin) {
    return new Response();
  }

  // An order deleted after the webhook was sent is not stored, and the response is
  // still 200: non-2xx would make Shopify retry a delivery that can never succeed.
  await ingestOrder(admin, shop, payload.admin_graphql_api_id);
  return new Response();
};
