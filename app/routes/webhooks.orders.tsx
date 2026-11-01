import type { ActionFunctionArgs } from "react-router";
import { mapOrder } from "../lib/domain/order-mapper";
import { saveOrder } from "../lib/repositories/order-repository.server";
import { ORDER_QUERY } from "../lib/shopify/order-query";
import { authenticate } from "../shopify.server";

// orders/create and orders/updated (shopify.app.toml). The payload is only a
// trigger: the order is refetched via GraphQL (ADR-0003).
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, payload, shop } = await authenticate.webhook(request);

  // No offline session: the app was uninstalled, so there is nothing to fetch with.
  if (!admin) {
    return new Response();
  }

  const response = await admin.graphql(ORDER_QUERY, {
    variables: { id: payload.admin_graphql_api_id },
  });
  const { data } = await response.json();

  // Deleted after the webhook was sent. Non-2xx would make Shopify retry a
  // delivery that can never succeed.
  if (!data?.order) {
    return new Response();
  }

  await saveOrder(mapOrder(shop, data.order));
  return new Response();
};
