interface ExportButtonProps {
  exporting: boolean;
  onExport: () => void;
  // See SyncButton.
  slot?: "secondary-actions";
}

// Downloads the shop's orders as a CSV file (#5). Presentational: the page owns the
// request and shows a failure.
export function ExportButton({ exporting, onExport, slot }: ExportButtonProps) {
  return (
    // The attributes are only added while exporting: see SyncButton.
    <s-button
      slot={slot}
      onClick={onExport}
      {...(exporting ? { disabled: true, loading: true } : {})}
    >
      Export CSV
    </s-button>
  );
}
