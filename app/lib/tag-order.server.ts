import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { normalizeTag } from "./domain/normalize-tag";
import {
  findOrderTags,
  updateOrderTags,
} from "./repositories/order-repository.server";
import { ADD_ORDER_TAG_MUTATION } from "./shopify/order-tags-mutation";

export type TagResult = { ok: true } | { error: string };

// Adds a tag to an order: Shopify first, then the stored copy (ADR-0004).
export async function addOrderTag(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
  input: string,
): Promise<TagResult> {
  const tags = await findOrderTags(shop, orderId);
  if (!tags) {
    return { error: "This order could not be found" };
  }
  const normalized = normalizeTag(input, tags);
  if ("error" in normalized) {
    return normalized;
  }

  const response = await admin.graphql(ADD_ORDER_TAG_MUTATION, {
    variables: { id: orderId, tags: [normalized.tag] },
  });
  const { data } = await response.json();
  const node = data?.tagsAdd?.node;
  if (!node || !("tags" in node)) {
    throw new Error("tagsAdd returned no order");
  }

  await updateOrderTags(shop, orderId, node.tags, new Date(node.updatedAt));
  return { ok: true };
}
