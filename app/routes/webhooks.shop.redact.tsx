import type { ActionFunctionArgs } from "react-router";
import { deleteShopData } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// shop/redact (compliance topic, shopify.app.toml). Shopify sends it 48 hours after
// the app is uninstalled. app/uninstalled has normally deleted the shop's data
// already; this deletes whatever is left, and is harmless when nothing is.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, session, shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // The shop comes from the X-Shopify-Shop-Domain header, which the HMAC does
  // not cover. The signed body names the shop too, so a body signed for one shop
  // cannot be resent for another.
  if (payload.shop_domain !== shop) {
    return new Response(undefined, { status: 401 });
  }

  // app/uninstalled deletes the shop's sessions, so a session here means the app
  // was installed again within the 48 hours. Shopify's docs do not say whether a
  // reinstall cancels shop/redact; the data now belongs to the new install.
  if (session) {
    console.log(`Kept the data of ${shop}: the app is installed again`);
    return new Response();
  }

  await deleteShopData(shop);

  return new Response();
};
