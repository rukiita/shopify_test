import type { ActionFunctionArgs } from "react-router";
import { addOrderTag, TAG_NOT_SAVED } from "../lib/tag-order.server";
import { authenticate } from "../shopify.server";

// Tag edits from the order list (ADR-0004). POST only; there is no page here.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const form = await request.formData();
  const orderId = form.get("orderId");
  const tag = form.get("tag");
  if (
    form.get("intent") !== "add" ||
    typeof orderId !== "string" ||
    typeof tag !== "string"
  ) {
    return TAG_NOT_SAVED;
  }

  return addOrderTag(admin, session.shop, orderId, tag);
};
