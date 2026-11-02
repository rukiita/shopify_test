import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { normalizeTag } from "./domain/normalize-tag";
import { ingestOrder } from "./ingest-order.server";
import { findOrderTags } from "./repositories/order-repository.server";
import {
  ADD_ORDER_TAG_MUTATION,
  REMOVE_ORDER_TAG_MUTATION,
} from "./shopify/order-tags-mutation";

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
  try {
    const tags = await findOrderTags(shop, orderId);
    if (!tags) {
      return { error: "This order could not be found" };
    }
    let normalized = normalizeTag(input, tags);
    // Rejected only because of the stored tags, which are behind Shopify while a webhook
    // is late. Otherwise a tag just removed in the Shopify admin could not be added back.
    if ("error" in normalized && !("error" in normalizeTag(input, []))) {
      await ingestOrder(admin, shop, orderId);
      normalized = normalizeTag(
        input,
        (await findOrderTags(shop, orderId)) ?? [],
      );
    }
    if ("error" in normalized) {
      return normalized;
    }

    const response = await admin.graphql(ADD_ORDER_TAG_MUTATION, {
      variables: { id: orderId, tags: [normalized.tag] },
    });
    const { data } = await response.json();
    const userError = data?.tagsAdd?.userErrors[0];
    if (userError) {
      return { error: userError.message };
    }
    if (!data?.tagsAdd?.node) {
      throw new Error("tagsAdd returned no order");
    }

    await storeOrderAfterWrite(admin, shop, orderId);
    return { ok: true };
  } catch (error) {
    rethrowExpiredToken(error);
    console.error(`Adding a tag to ${orderId} of ${shop} failed`, error);
    return TAG_NOT_SAVED;
  }
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
    return { error: "This order could not be found" };
  }
  if (!tags.includes(tag)) {
    return { error: "This order does not have that tag" };
  }

  try {
    const response = await admin.graphql(REMOVE_ORDER_TAG_MUTATION, {
      variables: { id: orderId, tags: [tag] },
    });
    const { data } = await response.json();
    const userError = data?.tagsRemove?.userErrors[0];
    if (userError) {
      return { error: userError.message };
    }
    if (!data?.tagsRemove?.node) {
      throw new Error("tagsRemove returned no order");
    }

    await storeOrderAfterWrite(admin, shop, orderId);
    return { ok: true };
  } catch (error) {
    rethrowExpiredToken(error);
    console.error(`Removing a tag from ${orderId} of ${shop} failed`, error);
    return { error: "The tag could not be removed. Try again." };
  }
}

// Refetches and stores the whole order, as a webhook would (ADR-0003). Writing only the
// tags would move the stored updatedAt past columns that are still old, and then neither
// a late webhook nor a sync would repair them. A write can also change nothing in
// Shopify, and then no orders/updated follows.
//
// A failure here is logged, not returned: the write has reached Shopify, and the
// orders/updated for it repairs the stored copy.
async function storeOrderAfterWrite(
  admin: AdminApiContext,
  shop: string,
  orderId: string,
) {
  try {
    await ingestOrder(admin, shop, orderId);
  } catch (error) {
    rethrowExpiredToken(error);
    console.error(
      `Storing ${orderId} of ${shop} after a tag edit failed`,
      error,
    );
  }
}

// A 401 Response asks App Bridge to get a new session token and retry.
function rethrowExpiredToken(error: unknown) {
  if (error instanceof Response && error.status === 401) {
    throw error;
  }
}
