import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { deleteShopData } from "../lib/repositories/order-repository.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Every step deletes by shop, so a repeated delivery is harmless, and it runs even when
  // an earlier delivery already deleted the sessions.
  await deleteShopData(shop);
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
