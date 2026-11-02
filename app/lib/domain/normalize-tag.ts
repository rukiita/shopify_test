// Measured on the development store (#3): 56 gives "Order tags is invalid". The docs do
// not state a limit.
const MAX_TAG_LENGTH = 55;

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
  // tagsAdd would split it into two tags.
  if (tag.includes(",")) {
    return { error: "A tag can't contain a comma" };
  }
  // By character: Shopify counts an emoji as one, and `length` as two.
  if ([...tag].length > MAX_TAG_LENGTH) {
    return { error: `A tag can have at most ${MAX_TAG_LENGTH} characters` };
  }
  const lowerCase = tag.toLowerCase();
  if (existing.some((other) => other.toLowerCase() === lowerCase)) {
    return { error: "This order already has that tag" };
  }
  return { tag };
}
