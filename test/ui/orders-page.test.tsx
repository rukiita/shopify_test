// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";
import { afterEach, expect, it } from "vitest";
import type { OrderListRow } from "../../app/lib/domain/order-list-row";
import {
  ErrorBoundary as AppErrorBoundary,
  shouldRevalidate,
} from "../../app/routes/app";
import Orders, {
  ErrorBoundary as OrdersErrorBoundary,
} from "../../app/routes/app._index";

afterEach(cleanup);

const row = (number: number): OrderListRow => ({
  id: `gid://shopify/Order/${number}`,
  name: `#${number}`,
  createdAt: "2026-11-01T05:17:27.000Z",
  customerName: null,
  customerEmail: null,
  total: "$1.00",
  paymentGateways: [],
  tags: [],
});

const page = (orders: OrderListRow[]) => ({
  orders,
  hasNextPage: true,
  hasPreviousPage: true,
});

// The app route and the order list route, nested as in the app. Each loader is given
// by the test; the app route's content stands in for its nav.
function renderOrders({
  appLoader = () => null,
  ordersLoader,
  url = "/",
}: {
  appLoader?: () => unknown;
  ordersLoader: (args: { request: Request }) => unknown;
  url?: string;
}) {
  const Stub = createRoutesStub([
    {
      id: "routes/app",
      path: "/",
      Component: () => (
        <>
          <nav>Nav</nav>
          <Outlet />
        </>
      ),
      HydrateFallback: () => null,
      ErrorBoundary: AppErrorBoundary,
      shouldRevalidate,
      loader: appLoader,
      children: [
        {
          id: "routes/app._index",
          index: true,
          // The stub's types want its own loader data, not this route's.
          Component: Orders as never,
          ErrorBoundary: OrdersErrorBoundary,
          loader: ordersLoader as never,
        },
      ],
    },
  ]);
  return render(<Stub initialEntries={[url]} />);
}

const table = (container: HTMLElement) =>
  waitFor(() => {
    const element = container.querySelector("s-table");
    if (!element) throw new Error("The table is not rendered yet");
    return element;
  });

it("BE-2 Order list : 1. a failure of both the app route and the order list shows the banner", async () => {
  const fail = () => {
    throw new TypeError("Failed to fetch");
  };
  const { container } = renderOrders({ appLoader: fail, ordersLoader: fail });

  await waitFor(() => {
    expect(container.querySelector("s-banner")?.getAttribute("heading")).toBe(
      "Orders could not be loaded",
    );
  });
});

it("BE-2 Order list : 1. changing page does not run the app route's loader again, so a failure keeps the nav", async () => {
  let appLoads = 0;
  let orderLoads = 0;
  const { container } = renderOrders({
    appLoader: () => {
      appLoads += 1;
      return null;
    },
    ordersLoader: () => {
      orderLoads += 1;
      if (orderLoads > 1) throw new TypeError("Failed to fetch");
      return page([row(2), row(1)]);
    },
  });

  (await table(container)).dispatchEvent(new Event("nextpage"));

  await waitFor(() => {
    expect(container.querySelector("s-banner")).not.toBeNull();
  });
  expect(appLoads).toBe(1);
  expect(container.querySelector("nav")?.textContent).toBe("Nav");
});
