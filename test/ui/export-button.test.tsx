// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ExportButton } from "../../app/components/export-button";

afterEach(cleanup);

const noop = () => {};

it("BE-5 CSV export : 1. the export button is disabled while exporting and shows a failure", () => {
  const { container, rerender } = render(
    <ExportButton exporting={false} failed={false} onExport={noop} />,
  );
  const button = () => container.querySelector("s-button");
  const failure = () => container.querySelector('s-text[tone="critical"]');
  expect(button()?.textContent).toBe("Export CSV");
  expect(button()?.hasAttribute("disabled")).toBe(false);
  expect(failure()).toBeNull();

  rerender(<ExportButton exporting failed={false} onExport={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(true);
  expect(button()?.hasAttribute("loading")).toBe(true);

  rerender(<ExportButton exporting={false} failed onExport={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(false);
  expect(failure()?.textContent).toBe(
    "The orders could not be exported. Try again.",
  );
});
