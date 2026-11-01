import type { ActionFunctionArgs } from "react-router";
import { deleteShopData } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// shop/redact (compliance topic, shopify.app.toml). Shopify sends it 48 hours after
// the app is uninstalled. app/uninstalled has normally deleted the shop's data
// already; this deletes whatever is left, and is harmless when nothing is.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);

  // The shop comes from the X-Shopify-Shop-Domain header, which the HMAC does
  // not cover. The signed body names the shop too, so a body signed for one shop
  // cannot be resent for another.
  if (payload.shop_domain !== shop) {
    return new Response(undefined, { status: 401 });
  }

  await deleteShopData(shop);

  return new Response();
};
