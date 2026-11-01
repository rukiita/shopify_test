import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// customers/data_request (compliance topic, shopify.app.toml). The app sends
// nothing to the customer. The customer data it stores (email, name and address
// on orders) comes from the merchant's own Shopify orders, so the merchant
// already has it (README, "Customer data"). Only the request ID is logged, never
// the customer's details.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop}, data request ${payload.data_request?.id}`,
  );

  return new Response();
};
