// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { afterEach, expect, it } from "vitest";
import {
  OrderListError,
  OrderListErrorBoundary,
} from "../../app/components/order-list-error";

afterEach(cleanup);

const renderFailingRoute = (failure: unknown) => {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => <p>Orders</p>,
      HydrateFallback: () => null,
      ErrorBoundary: OrderListErrorBoundary,
      loader: () => {
        throw failure;
      },
    },
  ]);
  return render(<Stub />);
};

it("BE-2 Order list : 1. an unexpected error shows a banner with a way to try again", async () => {
  const { container } = renderFailingRoute(new Error("database is locked"));

  await waitFor(() => {
    const banner = container.querySelector("s-banner");
    expect(banner?.getAttribute("tone")).toBe("critical");
    expect(banner?.getAttribute("heading")).toBe("Orders could not be loaded");
  });
  // The cause stays in the server log.
  expect(container.textContent).not.toContain("database is locked");
});

it("BE-2 Order list : 1. a response Shopify's auth throws goes to boundary.error instead of the banner", async () => {
  const { container } = renderFailingRoute(
    new Response("Handled by App Bridge", { status: 401 }),
  );

  await waitFor(() => {
    expect(container.textContent).toContain("Handled by App Bridge");
  });
  expect(container.querySelector("s-banner")).toBeNull();
});

it("BE-2 Order list : 1. the banner's button tries again", () => {
  let retries = 0;
  const { container } = render(<OrderListError onRetry={() => retries++} />);

  const button = container.querySelector("s-banner s-button") as HTMLElement;
  expect(button.textContent).toBe("Try again");
  button.click();

  expect(retries).toBe(1);
});

it("BE-2 Order list : 1. the banner's button shows that it is trying again", () => {
  const { container } = render(<OrderListError retrying onRetry={() => {}} />);

  const button = container.querySelector("s-banner s-button");
  expect(button?.hasAttribute("disabled")).toBe(true);
  expect(button?.hasAttribute("loading")).toBe(true);
});
