import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../lib/repositories/order-repository.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Everything is deleted by shop, so a repeated delivery is harmless, and it runs even when
  // an earlier delivery already deleted the sessions.
  await deleteShopData(shop);

  return new Response();
};
