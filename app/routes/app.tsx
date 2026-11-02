import type {
  HeadersFunction,
  LoaderFunctionArgs,
  ShouldRevalidateFunction,
} from "react-router";
import { Outlet, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { OrderListErrorBoundary } from "../components/order-list-error";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
// Declares App Bridge's elements for TypeScript, such as s-app-nav below.
import type {} from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

// A change of the query alone, such as the order list's page, needs nothing new from
// this route, and the child route's loader authenticates the request itself. Skipping
// this loader also keeps the nav on screen when that request fails: a failed request
// fails every route it covers, and the topmost route's boundary would replace them all.
export const shouldRevalidate: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) =>
  currentUrl.pathname === nextUrl.pathname &&
  currentUrl.search !== nextUrl.search
    ? false
    : defaultShouldRevalidate;

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Orders</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
// OrderListErrorBoundary passes those to boundary.error. Anything else would be
// rethrown there, so a failure of this route's loader, or of a Sync request, which has
// no boundary of its own, shows the banner too.
export const ErrorBoundary = OrderListErrorBoundary;

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
