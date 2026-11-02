import { isRouteErrorResponse, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

interface OrderListErrorProps {
  onRetry: () => void;
}

export function OrderListError({ onRetry }: OrderListErrorProps) {
  return (
    <s-page heading="Orders">
      <s-banner tone="critical" heading="Orders could not be loaded">
        <s-paragraph>Check your connection and try again.</s-paragraph>
        <s-button slot="secondary-actions" onClick={onRetry}>
          Try again
        </s-button>
      </s-banner>
    </s-page>
  );
}

// A failed page load shows a banner instead of React Router's error page. Responses
// still go to boundary.error, because Shopify's auth throws them and needs their
// content rendered as it is.
export function OrderListErrorBoundary() {
  const error = useRouteError();

  return isRouteErrorResponse(error) ? (
    boundary.error(error)
  ) : (
    <OrderListError onRetry={() => window.location.reload()} />
  );
}
