import type { ActionFunctionArgs } from "react-router";
import { redactCustomer } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// customers/redact (compliance topic, shopify.app.toml). Shopify sends it 10 days
// after a merchant requests the deletion of a customer's data. The payload lists
// the customer's orders by numeric ID; the app stores them by GID.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);

  // A missing list is treated as empty, so the request is still acknowledged
  // instead of failing on every retry.
  const listed: number[] = Array.isArray(payload.orders_to_redact)
    ? payload.orders_to_redact
    : [];
  const orderIds = listed.map((id) => `gid://shopify/Order/${id}`);
  await redactCustomer(shop, orderIds);

  return new Response();
};
