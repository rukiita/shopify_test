import type { ActionFunctionArgs } from "react-router";
import { redactCustomer } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// customers/redact (compliance topic, shopify.app.toml). Shopify sends it 10 days
// after a merchant requests the deletion of a customer's data. The payload lists
// the customer's orders by numeric ID; the app stores them by GID.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop } = await authenticate.webhook(request);

  const orderIds = (payload.orders_to_redact as number[]).map(
    (id) => `gid://shopify/Order/${id}`,
  );
  await redactCustomer(shop, orderIds);

  return new Response();
};
