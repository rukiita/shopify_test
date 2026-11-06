interface SyncButtonProps {
  syncing: boolean;
  onSync: () => void;
  // "secondary-actions" puts it in the page's actions, which App Bridge shows in the
  // admin's title bar (#122).
  slot?: "secondary-actions";
}

// Imports orders placed before the app was installed (#21). Presentational: the
// page owns the request and shows its result.
export function SyncButton({ syncing, onSync, slot }: SyncButtonProps) {
  return (
    // React 18 writes `disabled={false}` as the attribute disabled="false", which
    // still disables the button, so the attributes are only added while syncing.
    <s-button
      slot={slot}
      onClick={onSync}
      {...(syncing ? { disabled: true, loading: true } : {})}
    >
      Sync orders
    </s-button>
  );
}
