// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { createRoutesStub, Outlet } from "react-router";
import { afterEach, expect, it, vi } from "vitest";
import type { OrderListRow } from "../../app/lib/domain/order-list-row";
import {
  ErrorBoundary as AppErrorBoundary,
  shouldRevalidate,
} from "../../app/routes/app";
import Orders, {
  ErrorBoundary as OrdersErrorBoundary,
} from "../../app/routes/app._index";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
// by the test; the app route's content stands in for its nav. App Bridge's `shopify`
// global is replaced, and `toast` records the toasts shown.
function renderOrders({
  appLoader = () => null,
  ordersLoader,
  tagsAction = () => null,
  syncAction = () => ({ synced: 0 }),
  url = "/",
}: {
  appLoader?: () => unknown;
  ordersLoader: (args: { request: Request }) => unknown;
  tagsAction?: (args: { request: Request }) => unknown;
  syncAction?: (args: { request: Request }) => unknown;
  url?: string;
}) {
  const toast = vi.fn<(message: string) => void>();
  vi.stubGlobal("shopify", { toast: { show: toast } });
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
    { path: "/app/tags", action: tagsAction as never },
    { path: "/app/sync", action: syncAction as never },
  ]);
  return { ...render(<Stub initialEntries={[url]} />), toast };
}

// The buttons in `s-page`'s secondary-actions slot, which App Bridge shows in the
// admin's title bar.
const pageActions = (container: HTMLElement) =>
  [...container.querySelectorAll('s-page > [slot="secondary-actions"]')].map(
    (action) => action.textContent,
  );

const buttonsNamed = (container: HTMLElement, name: string) =>
  [...container.querySelectorAll("s-button")].filter(
    (button) => button.textContent === name,
  );

const banner = (container: HTMLElement) =>
  container.querySelector('s-banner[tone="critical"]')?.textContent;

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

it("BE-2 Order list : 1. with orders, Sync orders and Export CSV are page actions in the title bar", async () => {
  const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });
  await table(container);

  expect(pageActions(container)).toEqual(["Sync orders", "Export CSV"]);
  expect(buttonsNamed(container, "Sync orders")).toHaveLength(1);
  expect(buttonsNamed(container, "Export CSV")).toHaveLength(1);
});

it("BE-2 Order list : 1. the empty state has the Sync button in the page body, and no page actions", async () => {
  const { container } = renderOrders({ ordersLoader: () => page([]) });
  await waitFor(() => {
    expect(container.querySelector("s-heading")).not.toBeNull();
  });

  expect(pageActions(container)).toEqual([]);
  const sync = buttonsNamed(container, "Sync orders");
  expect(sync).toHaveLength(1);
  expect(sync[0].hasAttribute("slot")).toBe(false);
  expect(buttonsNamed(container, "Export CSV")).toHaveLength(0);
  expect(container.textContent).toContain("last 60 days");
});

const syncButton = async (container: HTMLElement) => {
  await waitFor(() => {
    if (buttonsNamed(container, "Sync orders").length === 0) {
      throw new Error("The Sync button is not rendered yet");
    }
  });
  return buttonsNamed(container, "Sync orders")[0];
};

it("BE-1 Webhook ingestion : 3. a finished sync shows how many orders were imported in a toast", async () => {
  const { container, toast } = renderOrders({
    ordersLoader: () => page([row(1)]),
    syncAction: () => ({ synced: 3 }),
  });

  fireEvent.click(await syncButton(container));

  await waitFor(() => expect(toast).toHaveBeenCalledWith("Imported 3 orders"));
  expect(toast).toHaveBeenCalledTimes(1);
  expect(banner(container)).toBeUndefined();
});

it("BE-1 Webhook ingestion : 3. a sync that stops partway shows a banner with the count", async () => {
  const { container, toast } = renderOrders({
    ordersLoader: () => page([row(1)]),
    syncAction: () => ({ synced: 2, failed: true }),
  });

  fireEvent.click(await syncButton(container));

  await waitFor(() => {
    expect(banner(container)).toBe(
      "Sync stopped after importing 2 orders. Run it again to continue.",
    );
  });
  expect(toast).not.toHaveBeenCalled();
});

it("BE-1 Webhook ingestion : 3. a click while a sync runs starts no second sync", async () => {
  let finish: (result: { synced: number }) => void = () => {};
  const syncAction = vi.fn(
    () =>
      new Promise<{ synced: number }>((resolve) => {
        finish = resolve;
      }),
  );
  const { container, toast } = renderOrders({
    ordersLoader: () => page([row(1)]),
    syncAction,
  });
  const button = await syncButton(container);

  fireEvent.click(button);
  await waitFor(() => expect(syncAction).toHaveBeenCalledTimes(1));
  fireEvent.click(button);
  finish({ synced: 1 });

  await waitFor(() => expect(toast).toHaveBeenCalledWith("Imported 1 order"));
  expect(syncAction).toHaveBeenCalledTimes(1);
});

it("BE-3 Add tag : 1. the order list sends the tag to the tag action, and shows the order's new tags", async () => {
  const sent: Record<string, FormDataEntryValue>[] = [];
  let tags: string[] = [];
  const { container } = renderOrders({
    ordersLoader: () => page([{ ...row(1), tags }]),
    tagsAction: async ({ request }) => {
      sent.push(Object.fromEntries(await request.formData()));
      tags = ["VIP"];
      return { ok: true };
    },
  });
  await table(container);

  Object.assign(container.querySelector("s-text-field")!, { value: "VIP" });
  fireEvent.submit(container.querySelector("form")!);

  await waitFor(() => {
    expect(container.querySelector("s-chip")?.textContent).toBe("VIP");
  });
  expect(sent).toEqual([
    { intent: "add", orderId: "gid://shopify/Order/1", tag: "VIP" },
  ]);
});

it("BE-3 Add tag : 1. the order list shows the reason only on the order it is about", async () => {
  const error = "This order already has that tag";
  const { container } = renderOrders({
    ordersLoader: () => page([row(2), row(1)]),
    tagsAction: () => ({ error }),
  });
  await table(container);
  const fields = () => [...container.querySelectorAll("s-text-field")];
  expect(fields()).toHaveLength(2);

  Object.assign(fields()[1], { value: "VIP" });
  fireEvent.submit(container.querySelectorAll("form")[1]);

  await waitFor(() => {
    expect(fields()[1].getAttribute("error")).toBe(error);
  });
  expect(fields()[0].hasAttribute("error")).toBe(false);
});

it("BE-4 Remove tag : 1. the tag stays and an error is shown when the removal fails", async () => {
  const sent: Record<string, FormDataEntryValue>[] = [];
  const error = "The tag could not be removed. Try again.";
  const { container } = renderOrders({
    ordersLoader: () => page([{ ...row(1), tags: ["VIP"] }]),
    tagsAction: async ({ request }) => {
      sent.push(Object.fromEntries(await request.formData()));
      return { error };
    },
  });
  await table(container);

  fireEvent.click(container.querySelector('s-button[icon="x"]')!);

  await waitFor(() => {
    expect(
      container.querySelector('s-text[tone="critical"]')?.textContent,
    ).toBe(error);
  });
  expect(sent).toEqual([
    { intent: "remove", orderId: "gid://shopify/Order/1", tag: "VIP" },
  ]);
  expect(container.querySelector("s-chip")?.textContent).toBe("VIP");
});

it("BE-4 Remove tag : 1. the order list stops showing a tag once it is removed", async () => {
  let tags = ["VIP", "wholesale"];
  const { container } = renderOrders({
    ordersLoader: () => page([{ ...row(1), tags }]),
    tagsAction: () => {
      tags = ["wholesale"];
      return { ok: true };
    },
  });
  await table(container);

  fireEvent.click(container.querySelector('s-button[icon="x"]')!);

  await waitFor(() => {
    expect(
      [...container.querySelectorAll("s-chip")].map((chip) => chip.textContent),
    ).toEqual(["wholesale"]);
  });
});

it("BE-4 Remove tag : 1. removing a tag keeps what was typed in the field", async () => {
  let tags = ["VIP", "wholesale"];
  const { container } = renderOrders({
    ordersLoader: () => page([{ ...row(1), tags }]),
    tagsAction: () => {
      tags = ["wholesale"];
      return { ok: true };
    },
  });
  await table(container);
  const typedIn = container.querySelector("s-text-field");

  fireEvent.click(container.querySelector('s-button[icon="x"]')!);

  await waitFor(() => {
    expect(container.querySelectorAll("s-chip")).toHaveLength(1);
  });
  expect(container.querySelector("s-text-field")).toBe(typedIn);
});

it("BE-4 Remove tag : 1. the next attempt on the row clears a failed removal's error", async () => {
  const error = "The tag could not be removed. Try again.";
  const { container } = renderOrders({
    ordersLoader: () => page([{ ...row(1), tags: ["VIP"] }]),
    tagsAction: async ({ request }) =>
      (await request.formData()).get("intent") === "remove"
        ? { error }
        : { ok: true },
  });
  await table(container);
  const message = () => container.querySelector('s-text[tone="critical"]');

  fireEvent.click(container.querySelector('s-button[icon="x"]')!);
  await waitFor(() => expect(message()?.textContent).toBe(error));

  Object.assign(container.querySelector("s-text-field")!, { value: "new" });
  fireEvent.submit(container.querySelector("form")!);

  await waitFor(() => expect(message()).toBeNull());
});

const exportButton = async (container: HTMLElement) => {
  await table(container);
  return buttonsNamed(container, "Export CSV")[0];
};

// jsdom has no object URLs and does not follow a link's download.
function spyOnSaving() {
  const blobs: Blob[] = [];
  Object.assign(URL, {
    createObjectURL: (blob: Blob) => {
      blobs.push(blob);
      return "blob:orders";
    },
    revokeObjectURL: () => {},
  });
  const saved: { href: string; download: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({
      href: this.getAttribute("href")!,
      download: this.download,
    });
  });
  return { blobs, saved };
}

const csvResponse = () =>
  new Response("the csv", {
    headers: { "Content-Type": "text/csv; charset=utf-8" },
  });

const exportError = banner;

it("BE-5 CSV export : 1. the order list saves the file from the export route", async () => {
  const fetched = vi.fn<(url: string) => Promise<Response>>(async () =>
    csvResponse(),
  );
  vi.stubGlobal("fetch", fetched);
  const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });
  const button = await exportButton(container);
  const { blobs, saved } = spyOnSaving();

  fireEvent.click(button);

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(fetched.mock.calls.map(([url]) => url)).toEqual(["/app/export"]);
  expect(saved).toEqual([{ href: "blob:orders", download: "orders.csv" }]);
  expect(await blobs[0].text()).toBe("the csv");
});

it("BE-5 CSV export : 1. the order list disables the export button until the export finishes", async () => {
  let finish: (response: Response) => void = () => {};
  vi.stubGlobal(
    "fetch",
    vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    ),
  );
  const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });
  const button = await exportButton(container);
  const { saved } = spyOnSaving();

  fireEvent.click(button);

  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
  finish(csvResponse());
  await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
  expect(saved).toHaveLength(1);
});

it("BE-5 CSV export : 1. a click while an export runs starts no second export", async () => {
  let finish: (response: Response) => void = () => {};
  const fetched = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        finish = resolve;
      }),
  );
  vi.stubGlobal("fetch", fetched);
  const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });
  const button = await exportButton(container);
  const { saved } = spyOnSaving();

  fireEvent.click(button);
  fireEvent.click(button);
  finish(csvResponse());

  await waitFor(() => expect(saved).toHaveLength(1));
  expect(fetched).toHaveBeenCalledTimes(1);
});

it.each([
  ["fails", () => new Response("", { status: 500 })],
  [
    "returns something other than a CSV",
    () =>
      new Response("<script></script>", {
        headers: { "Content-Type": "text/html;charset=utf-8" },
      }),
  ],
])(
  "BE-5 CSV export : 1. the order list logs an error, shows it and saves nothing when the export %s",
  async (_case, response) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => response()),
    );
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });
    const button = await exportButton(container);
    const { saved } = spyOnSaving();

    fireEvent.click(button);

    await waitFor(() => {
      expect(exportError(container)).toBe(
        "The orders could not be exported. Try again.",
      );
    });
    expect(saved).toEqual([]);
    expect(logged).toHaveBeenCalledWith(expect.any(Error));
  },
);

it("BE-5 CSV export : 1. the order list shows an error when the export request does not complete", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  vi.spyOn(console, "error").mockImplementation(() => {});
  const { container } = renderOrders({ ordersLoader: () => page([row(1)]) });

  fireEvent.click(await exportButton(container));

  await waitFor(() => {
    expect(exportError(container)).toBe(
      "The orders could not be exported. Try again.",
    );
  });
});
