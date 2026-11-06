// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { SyncButton } from "../../app/components/sync-button";

afterEach(cleanup);

const noop = () => {};

it("BE-1 Webhook ingestion : 3. the Sync button is disabled while a sync runs", () => {
  const { container, rerender } = render(
    <SyncButton syncing={false} onSync={noop} />,
  );
  const button = () => container.querySelector("s-button");
  expect(button()?.textContent).toBe("Sync orders");
  expect(button()?.hasAttribute("disabled")).toBe(false);
  expect(button()?.hasAttribute("slot")).toBe(false);

  rerender(<SyncButton syncing onSync={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(true);
  expect(button()?.hasAttribute("loading")).toBe(true);

  rerender(<SyncButton syncing={false} onSync={noop} />);
  expect(button()?.hasAttribute("disabled")).toBe(false);
});

it("BE-1 Webhook ingestion : 3. the Sync button can be a page action", () => {
  const { container } = render(
    <SyncButton slot="secondary-actions" syncing={false} onSync={noop} />,
  );

  expect(container.querySelector("s-button")?.getAttribute("slot")).toBe(
    "secondary-actions",
  );
});
