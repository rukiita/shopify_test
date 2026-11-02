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

it("BE-2 Order list : 1. Try again loads the page again without reloading the iframe", async () => {
  let failing = true;
  const { container } = renderOrders({
    ordersLoader: () => {
      if (failing) throw new TypeError("Failed to fetch");
      return page([row(1)]);
    },
  });
  const button = await waitFor(() => {
    const element = container.querySelector("s-banner s-button");
    if (!element) throw new Error("The banner is not rendered yet");
    return element as HTMLElement;
  });

  failing = false;
  button.click();

  await table(container);
  expect(container.querySelector("s-banner")).toBeNull();
});

it("BE-2 Order list : 1. next and previous change the cursor in the URL and keep the other parameters", async () => {
  const urls: URL[] = [];
  const { container } = renderOrders({
    url: "/?shop=test-shop.myshopify.com&host=abc&before=gid%3A%2F%2Fshopify%2FOrder%2F9",
    ordersLoader: ({ request }) => {
      urls.push(new URL(request.url));
      return page([row(5), row(4)]);
    },
  });
  const loaded = async (count: number) => {
    await waitFor(() => expect(urls).toHaveLength(count));
    return urls[count - 1].searchParams;
  };
  const element = await table(container);

  element.dispatchEvent(new Event("nextpage"));

  const next = await loaded(2);
  expect(next.get("after")).toBe("gid://shopify/Order/4");
  expect(next.has("before")).toBe(false);
  expect(next.get("shop")).toBe("test-shop.myshopify.com");
  expect(next.get("host")).toBe("abc");

  (await table(container)).dispatchEvent(new Event("previouspage"));

  const previous = await loaded(3);
  expect(previous.get("before")).toBe("gid://shopify/Order/5");
  expect(previous.has("after")).toBe(false);
  expect(previous.get("shop")).toBe("test-shop.myshopify.com");
  expect(previous.get("host")).toBe("abc");
});
