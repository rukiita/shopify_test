// Whether a fetched order may overwrite the stored copy, by Shopify's updatedAt.
// `stored` is null when the order is not stored yet. Only an older fetch is
// skipped: updatedAt has one-second precision, so an equal value can still carry
// a later change made in the same second.
export function shouldOverwrite(stored: Date | null, fetched: Date): boolean {
  return stored === null || fetched.getTime() >= stored.getTime();
}
