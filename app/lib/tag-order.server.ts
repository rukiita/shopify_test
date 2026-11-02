import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { normalizeTag } from "./domain/normalize-tag";
import {
  findOrderTags,
  updateOrderTags,
} from "./repositories/order-repository.server";
import {
  ADD_ORDER_TAG_MUTATION,
  REMOVE_ORDER_TAG_MUTATION,
} from "./shopify/order-tags-mutation";

export type TagResult = { ok: true } | { error: string };

export const TAG_NOT_SAVED = {
  error: "The tag could not be saved. Try again.",
};
const TAG_NOT_REMOVED = {
  error: "The tag could not be removed. Try again.",
};
const ORDER_NOT_FOUND = { error: "This order could not be found" };

// Adds a tag to an order: Shopify first, then the stored copy (ADR-0004).
export async function addOrderTag(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
  input: string,
): Promise<TagResult> {
  const tags = await findOrderTags(shop, orderId);
  if (!tags) {
    return ORDER_NOT_FOUND;
  }
  const normalized = normalizeTag(input, tags);
  if ("error" in normalized) {
    return normalized;
  }

  return writeTags(shop, orderId, TAG_NOT_SAVED, async () => {
    const response = await admin.graphql(ADD_ORDER_TAG_MUTATION, {
      variables: { id: orderId, tags: [normalized.tag] },
    });
    const { data } = await response.json();
    return data?.tagsAdd;
  });
}

// Removes a tag from an order: Shopify first, then the stored copy (ADR-0004). The tag
// is not normalized: it has to match a stored one exactly, because tagsRemove is
// case-sensitive, and a stored tag can be one that normalizeTag would not accept.
export async function removeOrderTag(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
  tag: string,
): Promise<TagResult> {
  const tags = await findOrderTags(shop, orderId);
  if (!tags) {
    return ORDER_NOT_FOUND;
  }
  if (!tags.includes(tag)) {
    return { error: "This order does not have that tag" };
  }

  return writeTags(shop, orderId, TAG_NOT_REMOVED, async () => {
    const response = await admin.graphql(REMOVE_ORDER_TAG_MUTATION, {
      variables: { id: orderId, tags: [tag] },
    });
    const { data } = await response.json();
    return data?.tagsRemove;
  });
}

interface TagMutationPayload {
  node?: { tags?: string[]; updatedAt?: string } | null;
  userErrors: { message: string }[];
}

// Sends a tag mutation, and on success stores the tags and updatedAt it returned.
async function writeTags(
  shop: string,
  orderId: string,
  failed: { error: string },
  mutate: () => Promise<TagMutationPayload | null | undefined>,
): Promise<TagResult> {
  try {
    const payload = await mutate();
    const userError = payload?.userErrors[0];
    if (userError) {
      return { error: userError.message };
    }
    const { tags, updatedAt } = payload?.node ?? {};
    if (!tags || !updatedAt) {
      throw new Error("The tag mutation returned no order");
    }

    await updateOrderTags(shop, orderId, tags, new Date(updatedAt));
    return { ok: true };
  } catch (error) {
    // Asks App Bridge to get a new session token and retry.
    if (error instanceof Response && error.status === 401) {
      throw error;
    }
    // Trying again is safe when the database write is what failed: tagsAdd and tagsRemove
    // do nothing for a tag already added or removed. The next orders/updated also
    // repairs it (ADR-0004).
    console.error(`A tag write to ${orderId} of ${shop} failed`, error);
    return failed;
  }
}
