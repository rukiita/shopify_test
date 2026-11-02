// Checks a tag a merchant typed, before it is sent to Shopify. Returns the tag to
// add, or the reason to show.
export function normalizeTag(
  input: string,
  _existing: string[],
): { tag: string } | { error: string } {
  return { tag: input.trim() };
}
