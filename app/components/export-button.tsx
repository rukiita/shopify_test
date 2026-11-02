interface ExportButtonProps {
  exporting: boolean;
  // The last export did not produce a file.
  failed: boolean;
  onExport: () => void;
}

// Downloads the shop's orders as a CSV file (#5). Presentational: the page owns the
// request.
export function ExportButton({
  exporting,
  failed,
  onExport,
}: ExportButtonProps) {
  return (
    <s-stack direction="inline" gap="base" alignItems="center">
      {/* The attributes are only added while exporting: see SyncButton. */}
      <s-button
        onClick={onExport}
        {...(exporting ? { disabled: true, loading: true } : {})}
      >
        Export CSV
      </s-button>
      {failed && !exporting && (
        <s-text tone="critical">
          The orders could not be exported. Try again.
        </s-text>
      )}
    </s-stack>
  );
}
