// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SyncButton } from "../../app/components/sync-button";

afterEach(cleanup);

const noop = () => {};

it("BE-1 Webhook ingestion : 3. the Sync button is disabled while a sync runs and shows the count afterwards", () => {
  const { container, rerender } = render(
    <SyncButton syncing={false} onSync={noop} />,
  );
  const button = () => container.querySelector("s-button");
  expect(button()?.textContent).toBe("Sync orders");
  expect(button()?.hasAttribute("disabled")).toBe(false);
  expect(container.textContent).not.toContain("Imported");

  rerender(<SyncButton syncing onSync={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(true);
  expect(button()?.hasAttribute("loading")).toBe(true);

  rerender(<SyncButton syncing={false} synced={3} onSync={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(false);
  expect(container.textContent).toContain("Imported 3 orders");
});

it("BE-1 Webhook ingestion : 3. the Sync button says how many orders were imported before a sync stopped", () => {
  const { container } = render(
    <SyncButton syncing={false} synced={2} failed onSync={noop} />,
  );

  const message = container.querySelector("s-text");
  expect(message?.getAttribute("tone")).toBe("critical");
  expect(message?.textContent).toBe(
    "Sync stopped after importing 2 orders. Run it again to continue.",
  );
});
