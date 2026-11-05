import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// customers/data_request (compliance topic, shopify.app.toml). The app sends
// nothing to the customer. The customer data it stores (email, name and address
// on orders) comes from the merchant's own Shopify orders, so the merchant
// already has it (docs/database.md, "Customer data"). Only the topic and shop are logged,
// never the customer's details.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  return new Response();
};
