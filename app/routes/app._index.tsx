import { useSyncExternalStore } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import {
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { OrderListErrorBoundary } from "../components/order-list-error";
import { OrderTable } from "../components/order-table";
import { SyncButton } from "../components/sync-button";
import { toOrderListRow } from "../lib/domain/order-list-row";
import { listOrders } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";
import type { action as syncAction } from "./app.sync";

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

  return (
    <s-page heading="Orders">
      <s-section>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Webhooks only report orders placed or changed after the app was
            installed. Sync imports the orders from the last 60 days.
          </s-paragraph>
          <SyncButton
            syncing={syncFetcher.state !== "idle"}
            synced={syncFetcher.data?.synced}
            failed={syncFetcher.data?.failed}
            onSync={syncOrders}
          />
        </s-stack>
      </s-section>
      <s-section padding="none" accessibilityLabel="Orders">
        <OrderTable
          orders={orders}
          timeZone={timeZone}
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
