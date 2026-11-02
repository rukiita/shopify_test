import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { normalizeTag } from "./domain/normalize-tag";
import {
  findOrderTags,
  updateOrderTags,
} from "./repositories/order-repository.server";
import { ADD_ORDER_TAG_MUTATION } from "./shopify/order-tags-mutation";

export type TagResult = { ok: true } | { error: string };

export const TAG_NOT_SAVED = {
  error: "The tag could not be saved. Try again.",
};

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

  try {
    const response = await admin.graphql(ADD_ORDER_TAG_MUTATION, {
      variables: { id: orderId, tags: [normalized.tag] },
    });
    const { data } = await response.json();
    const userError = data?.tagsAdd?.userErrors[0];
    if (userError) {
      return { error: userError.message };
    }
    const node = data?.tagsAdd?.node;
    if (!node || !("tags" in node)) {
      throw new Error("tagsAdd returned no order");
    }

    await updateOrderTags(shop, orderId, node.tags, new Date(node.updatedAt));
    return { ok: true };
  } catch (error) {
    // Asks App Bridge to get a new session token and retry.
    if (error instanceof Response && error.status === 401) {
      throw error;
    }
    // Trying again is safe when the database write is what failed: tagsAdd does nothing
    // for a tag the order has. The next orders/updated also repairs it (ADR-0004).
    console.error(`Adding a tag to ${orderId} of ${shop} failed`, error);
    return TAG_NOT_SAVED;
  }
}
