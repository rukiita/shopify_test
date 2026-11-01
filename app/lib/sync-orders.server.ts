import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { ingestOrder } from "./ingest-order.server";
import { findStoredUpdatedAt } from "./repositories/order-repository.server";
import { ORDER_IDS_QUERY } from "./shopify/order-ids-query";

// Imports the shop's existing orders (#21): pages through their IDs and ingests
// each one that changed since it was stored, as a webhook would. Returns how many
// orders were written.
//
// An order whose stored copy is as new as the listed updatedAt is not fetched
// again. So a sync that stopped partway, and is run again, only fetches the
// orders it has not stored yet.
//
// One order at a time, like the webhooks: writes are serialized anyway (#77).
//
// A failure, e.g. on the API rate limit, stops the sync: the orders written
// before it stay, and the result says it failed. A 401 Response is thrown on,
// because it asks App Bridge to get a new session token and retry.
export async function syncOrders(
  admin: AdminApiContext,
  shop: string,
): Promise<{ synced: number; failed?: true }> {
  let synced = 0;
  try {
    let after: string | null | undefined;
    do {
      const response = await admin.graphql(ORDER_IDS_QUERY, {
        variables: { after },
      });
      const { data } = await response.json();
      const orders = data!.orders;

      const stored = await findStoredUpdatedAt(
        shop,
        orders.nodes.map((order) => order.id),
      );
      for (const { id, updatedAt } of orders.nodes) {
        const storedUpdatedAt = stored.get(id);
        if (storedUpdatedAt && storedUpdatedAt >= new Date(updatedAt)) {
          continue;
        }
        // Not counted when nothing was written, e.g. deleted since it was listed.
        if (await ingestOrder(admin, shop, id)) {
          synced += 1;
        }
      }
      after = orders.pageInfo.hasNextPage ? orders.pageInfo.endCursor : null;
    } while (after);
  } catch (error) {
    if (error instanceof Response && error.status === 401) {
      throw error;
    }
    console.error(`Sync of ${shop} failed after ${synced} orders`, error);
    return { synced, failed: true };
  }
  return { synced };
}
