import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { ingestOrder } from "./ingest-order.server";
import { ORDER_IDS_QUERY } from "./shopify/order-ids-query";

// Imports the shop's existing orders (#21): pages through their IDs and ingests
// each one as a webhook would. Returns how many orders were ingested.
//
// One order at a time, like the webhooks: writes are serialized anyway (#77).
// A failed fetch throws, and the orders ingested before it stay; ingesting an
// order again is idempotent, so the sync can be run again.
export async function syncOrders(admin: AdminApiContext, shop: string) {
  let synced = 0;
  let after: string | null | undefined;
  do {
    const response = await admin.graphql(ORDER_IDS_QUERY, {
      variables: { after },
    });
    const { data } = await response.json();
    const orders = data!.orders;

    for (const { id } of orders.nodes) {
      // Deleted since it was listed: not stored, not counted.
      if (await ingestOrder(admin, shop, id)) {
        synced += 1;
      }
    }
    after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null;
  } while (after);
  return synced;
}
