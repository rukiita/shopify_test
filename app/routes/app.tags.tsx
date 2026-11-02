import type { ActionFunctionArgs } from "react-router";
import {
  addOrderTag,
  removeOrderTag,
  TAG_NOT_SAVED,
} from "../lib/tag-order.server";
import { authenticate } from "../shopify.server";

// Tag edits from the order list (ADR-0004). POST only; there is no page here.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  const form = await request.formData();
  const intent = form.get("intent");
  const orderId = form.get("orderId");
  const tag = form.get("tag");
  if (typeof orderId !== "string" || typeof tag !== "string") {
    return TAG_NOT_SAVED;
  }

  if (intent === "add") {
    return addOrderTag(admin, session.shop, orderId, tag);
  }
  if (intent === "remove") {
    return removeOrderTag(admin, session.shop, orderId, tag);
  }
  return TAG_NOT_SAVED;
};
