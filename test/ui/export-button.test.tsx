// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExportButton } from "../../app/components/export-button";

afterEach(cleanup);

const noop = () => {};

it("BE-5 CSV export : 1. the export button is disabled while exporting", () => {
  const { container, rerender } = render(
    <ExportButton exporting={false} onExport={noop} />,
  );
  const button = () => container.querySelector("s-button");
  expect(button()?.textContent).toBe("Export CSV");
  expect(button()?.hasAttribute("disabled")).toBe(false);

  rerender(<ExportButton exporting onExport={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(true);
  expect(button()?.hasAttribute("loading")).toBe(true);

  rerender(<ExportButton exporting={false} onExport={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(false);
});

it("BE-5 CSV export : 1. the export button can be a page action", () => {
  const { container } = render(
    <ExportButton slot="secondary-actions" exporting={false} onExport={noop} />,
  );

  expect(container.querySelector("s-button")?.getAttribute("slot")).toBe(
    "secondary-actions",
  );
});
