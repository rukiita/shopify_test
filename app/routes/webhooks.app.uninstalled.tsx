import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../lib/repositories/order-repository.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Everything is deleted by shop, so repeating the current uninstall is harmless, and it runs
  // even when an earlier delivery already deleted the sessions. A retry that arrives after a
  // reinstall deletes the new install's data too (README, "Known limitations", #74).
  await deleteShopData(shop);

  return new Response();
};
