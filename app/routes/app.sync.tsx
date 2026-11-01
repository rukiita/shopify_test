import type { ActionFunctionArgs } from "react-router";
import { syncOrders } from "../lib/sync-orders.server";
import { authenticate } from "../shopify.server";

// The Sync button (#21): imports orders placed before the app was installed,
// which never arrive via webhook. POST only; there is no page here.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  return syncOrders(admin, session.shop);
};
