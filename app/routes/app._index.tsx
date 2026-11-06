import { useEffect, useState, useSyncExternalStore } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
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
  // A request without a session token gets App Bridge's page, with status 200.
  const contentType = response.headers.get("Content-Type");
  if (!response.ok || !contentType?.startsWith("text/csv")) {
    throw new Error(
      `The export returned status ${response.status}, ${contentType}`,
    );
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

  const shopify = useAppBridge();

  // Sync and Export run from the title bar, which may not show a button as disabled,
  // so a click while one runs is ignored here.
  const syncFetcher = useFetcher<typeof syncAction>();
  const syncing = syncFetcher.state !== "idle";
  const syncOrders = () => {
    if (syncing) return;
    syncFetcher.submit({}, { method: "POST", action: "/app/sync" });
  };

  // The title bar has no room for text: a finished sync is reported in a toast, and a
  // failure in a banner on the page.
  const syncResult = syncFetcher.data;
  useEffect(() => {
    if (syncResult && !syncResult.failed) {
      shopify.toast.show(`Imported ${countOrders(syncResult.synced)}`);
    }
  }, [shopify, syncResult]);

  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);
  const exportOrders = async () => {
    if (exporting) return;
    setExporting(true);
    setExportFailed(false);
    try {
      await downloadOrdersCsv();
    } catch (error) {
      console.error(error);
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <s-page heading="Orders">
      {/* Page actions, shown in the admin's title bar so that they stay in view while
          the list scrolls (#122). Not in the empty state, which has its own Sync
          button: the same action should not be in both places. */}
      {orders.length > 0 && (
        <>
          <SyncButton
            slot="secondary-actions"
            syncing={syncing}
            onSync={syncOrders}
          />
          <ExportButton
            slot="secondary-actions"
            exporting={exporting}
            onExport={exportOrders}
          />
        </>
      )}
      {syncResult?.failed && !syncing && (
        <s-banner tone="critical">
          Sync stopped after importing {countOrders(syncResult.synced)}. Run it
          again to continue.
        </s-banner>
      )}
      {exportFailed && !exporting && (
        <s-banner tone="critical">
          The orders could not be exported. Try again.
        </s-banner>
      )}
      {orders.length > 0 && (
        <s-section>
          <s-paragraph>
            Webhooks only report orders placed or changed after the app was
            installed. Sync imports the orders from the last 60 days.
          </s-paragraph>
        </s-section>
      )}
      <s-section padding="none" accessibilityLabel="Orders">
        <OrderTable
          orders={orders}
          timeZone={timeZone}
          emptyAction={<SyncButton syncing={syncing} onSync={syncOrders} />}
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

const countOrders = (count: number) =>
  `${count} ${count === 1 ? "order" : "orders"}`;

export const ErrorBoundary = OrderListErrorBoundary;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
