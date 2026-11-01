import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { mapOrder } from "./domain/order-mapper";
import { saveOrder } from "./repositories/order-repository.server";
import { ORDER_QUERY } from "./shopify/order-query";

// The one ingestion path for an order, shared by the orders webhooks and the sync
// of existing orders (ADR-0003): refetch via GraphQL, map, then write.
//
// Returns false when the order no longer exists in Shopify, so nothing was written.
export async function ingestOrder(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
) {
  const response = await admin.graphql(ORDER_QUERY, {
    variables: { id: orderId },
  });
  const { data } = await response.json();

  if (!data?.order) {
    return false;
  }

  await saveOrder(mapOrder(shop, data.order));
  return true;
}
