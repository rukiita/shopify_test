import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteShopData } from "../lib/repositories/order-repository.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // The shop comes from the X-Shopify-Shop-Domain header, which the HMAC does
  // not cover. The signed body names the shop too, so a body signed for one shop
  // cannot be resent for another. Shopify's documented sample has null here; a
  // real delivery has the shop's domain (test/fixtures/app-uninstalled.json).
  if (payload.myshopify_domain !== shop) {
    console.error(
      `Rejected ${topic} webhook for ${shop}: the signed payload does not name this shop`,
    );
    return new Response(undefined, { status: 401 });
  }

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // Everything is deleted by shop, so repeating the current uninstall is harmless, and it runs
  // even when an earlier delivery already deleted the sessions. A retry that arrives after a
  // reinstall deletes the new install's data too (docs/known-limitations.md, #74).
  await deleteShopData(shop);

  return new Response();
};
