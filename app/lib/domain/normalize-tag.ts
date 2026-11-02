// Checks a tag a merchant typed, before it is sent to Shopify. Returns the tag to
// add, or the reason to show.
export function normalizeTag(
  input: string,
  existing: string[],
): { tag: string } | { error: string } {
  const tag = input.trim();
  if (!tag) {
    return { error: "Enter a tag" };
  }
  const lowerCase = tag.toLowerCase();
  if (existing.some((other) => other.toLowerCase() === lowerCase)) {
    return { error: "This order already has that tag" };
  }
  return { tag };
}
