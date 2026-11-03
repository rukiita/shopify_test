// The lines of a CSV file, without the BOM (response.text() has already removed it) and
// without the empty string after the last CRLF.
export const csvLines = (csv: string) =>
  csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")
    .slice(0, -1);
