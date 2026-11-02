import { useState, useSyncExternalStore } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { ExportButton } from "../components/export-button";
import { OrderListErrorBoundary } from "../components/order-list-error";
import { OrderTable } from "../components/order-table";
import { OrderTags } from "../components/order-tags";
import { SyncButton } from "../components/sync-button";
import {
  toOrderListRow,
  type OrderListRow,
} from "../lib/domain/order-list-row";
import { listOrders } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";
import type { action as syncAction } from "./app.sync";
import type { action as tagsAction } from "./app.tags";

// The order list (#2). Reads the app's copy of the orders, so showing a page makes
// no Shopify API call.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const { searchParams } = new URL(request.url);
  const page = await listOrders(session.shop, {
    after: searchParams.get("after") ?? undefined,
    before: searchParams.get("before") ?? undefined,
  });

  return { ...page, orders: page.orders.map(toOrderListRow) };
};

// The time zone never changes while the page is open.
const subscribeToTimeZone = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
// The server does not know the browser's time zone, so it renders UTC and the first
// client render switches to the browser's without a hydration mismatch.
const serverTimeZone = () => "UTC";

// Saves the shop's orders as a file. A plain link would not do: in the admin's iframe
// only fetch() carries the session token, which App Bridge adds to the request.
async function downloadOrdersCsv() {
  const response = await fetch("/app/export");
  if (!response.ok) {
    throw new Error(`The export failed with status ${response.status}`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = "orders.csv";
  link.click();
  // Not at once: the browser may still be reading it for the download.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// The row's own fetchers, so that saving and the result stay on that order's row. One each
// for adding and removing, because only an added tag clears the field, and the two show
// their errors in different places. Starting one clears the other's last result.
function OrderTagsCell({ order }: { order: OrderListRow }) {
  const adder = useFetcher<typeof tagsAction>();
  const remover = useFetcher<typeof tagsAction>();
  const submit = (
    fetcher: typeof adder,
    intent: "add" | "remove",
    tag: string,
  ) =>
    fetcher.submit(
      { intent, orderId: order.id, tag },
      { method: "POST", action: "/app/tags" },
    );

  return (
    <OrderTags
      orderName={order.name}
      tags={order.tags}
      saving={adder.state !== "idle" || remover.state !== "idle"}
      result={adder.data}
      removeError={
        remover.data && "error" in remover.data ? remover.data.error : undefined
      }
      onAdd={(tag) => {
        remover.reset();
        submit(adder, "add", tag);
      }}
      onRemove={(tag) => {
        adder.reset();
        submit(remover, "remove", tag);
      }}
    />
  );
}

export default function Orders() {
  const { orders, hasNextPage, hasPreviousPage } =
    useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [, setSearchParams] = useSearchParams();
  const timeZone = useSyncExternalStore(
    subscribeToTimeZone,
    browserTimeZone,
    serverTimeZone,
  );

  // Keeps the other parameters: the embedded app's URL carries `shop`, `host` etc.
  const goToPage = (cursor: "after" | "before", orderId?: string) => {
    if (!orderId) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("after");
      next.delete("before");
      next.set(cursor, orderId);
      return next;
    });
  };

  const syncFetcher = useFetcher<typeof syncAction>();
  const syncOrders = () =>
    syncFetcher.submit({}, { method: "POST", action: "/app/sync" });

  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const exportOrders = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      await downloadOrdersCsv();
    } catch {
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  const syncButton = (
    <SyncButton
      syncing={syncFetcher.state !== "idle"}
      synced={syncFetcher.data?.synced}
      failed={syncFetcher.data?.failed}
      onSync={syncOrders}
    />
  );

  return (
    <s-page heading="Orders">
      {orders.length > 0 && (
        <s-section>
          <s-stack direction="block" gap="base">
            <s-paragraph>
              Webhooks only report orders placed or changed after the app was
              installed. Sync imports the orders from the last 60 days.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              {syncButton}
              <ExportButton
                exporting={exporting}
                failed={exportFailed}
                onExport={exportOrders}
              />
            </s-stack>
          </s-stack>
        </s-section>
      )}
      <s-section padding="none" accessibilityLabel="Orders">
        <OrderTable
          orders={orders}
          timeZone={timeZone}
          emptyAction={syncButton}
          renderTags={(order) => <OrderTagsCell order={order} />}
          loading={navigation.state === "loading"}
          hasNextPage={hasNextPage}
          hasPreviousPage={hasPreviousPage}
          onNextPage={() => goToPage("after", orders.at(-1)?.id)}
          onPreviousPage={() => goToPage("before", orders[0]?.id)}
        />
      </s-section>
    </s-page>
  );
}

export const ErrorBoundary = OrderListErrorBoundary;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
