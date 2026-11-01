// Whether a fetched order may overwrite the stored copy, by Shopify's updatedAt.
// `stored` is null when the order is not stored yet. Equal is not newer: the
// stored copy already has that version, and a stale fetch must never win.
export function shouldOverwrite(stored: Date | null, fetched: Date): boolean {
  return stored === null || fetched.getTime() > stored.getTime();
}
