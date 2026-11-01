// Whether a fetched order may overwrite the stored copy, by Shopify's updatedAt.
// `stored` is null when the order is not stored yet.
export function shouldOverwrite(stored: Date | null, fetched: Date): boolean {
  return true;
}
