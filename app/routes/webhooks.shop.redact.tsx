import type { ActionFunctionArgs } from "react-router";
import { deleteShopData } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// shop/redact (compliance topic, shopify.app.toml). Shopify sends it 48 hours after
// the app is uninstalled. app/uninstalled has normally deleted the shop's data
// already; this deletes whatever is left, and is harmless when nothing is.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  await deleteShopData(shop);

  return new Response();
};
