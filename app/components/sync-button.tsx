interface SyncButtonProps {
  syncing: boolean;
  // How many orders the last sync imported, once one has finished.
  synced?: number;
  onSync: () => void;
}

// Imports orders placed before the app was installed (#21). Presentational: the
// page owns the request.
export function SyncButton({ syncing, synced, onSync }: SyncButtonProps) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {/* React 18 writes `disabled={false}` as the attribute disabled="false",
          which still disables the button, so the attributes are only added
          while syncing. */}
      <s-button
        onClick={onSync}
        {...(syncing ? { disabled: true, loading: true } : {})}
      >
        Sync orders
      </s-button>
      {synced !== undefined && !syncing && (
        <s-text>
          Imported {synced} {synced === 1 ? "order" : "orders"}
        </s-text>
      )}
    </s-stack>
  );
}
