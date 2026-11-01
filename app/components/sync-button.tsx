interface SyncButtonProps {
  syncing: boolean;
  // How many orders the last sync imported, once one has finished.
  synced?: number;
  // The last sync stopped partway; `synced` orders were written before it did.
  failed?: boolean;
  onSync: () => void;
}

// Imports orders placed before the app was installed (#21). Presentational: the
// page owns the request.
export function SyncButton({
  syncing,
  synced,
  failed,
  onSync,
}: SyncButtonProps) {
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
      {synced !== undefined &&
        !syncing &&
        (failed ? (
          <s-text tone="critical">
            Sync stopped after importing {synced} {orders(synced)}. Run it again
            to continue.
          </s-text>
        ) : (
          <s-text>
            Imported {synced} {orders(synced)}
          </s-text>
        ))}
    </s-stack>
  );
}

const orders = (count: number) => (count === 1 ? "order" : "orders");
