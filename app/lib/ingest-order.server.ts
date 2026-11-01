import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { mapOrder } from "./domain/order-mapper";
import { saveOrder } from "./repositories/order-repository.server";
import { ORDER_QUERY } from "./shopify/order-query";

// The one ingestion path for an order, shared by the orders webhooks and the sync
// of existing orders (ADR-0003): refetch via GraphQL, map, then write.
//
// Returns whether the order was written: not when it no longer exists in Shopify,
// the shop has no session (uninstalled), or the stored copy is newer.
//
// `tries` retries a request that Shopify answers with 429 or 503. Webhooks leave
// it at 1: a failed delivery is retried by Shopify.
export async function ingestOrder(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
  { tries = 1 }: { tries?: number } = {},
) {
  const response = await admin.graphql(ORDER_QUERY, {
    variables: { id: orderId },
    tries,
  });
  const { data } = await response.json();

  if (!data?.order) {
    return false;
  }

  return saveOrder(mapOrder(shop, data.order));
}
