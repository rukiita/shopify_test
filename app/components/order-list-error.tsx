import {
  isRouteErrorResponse,
  useLocation,
  useNavigate,
  useNavigation,
  useRouteError,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

interface OrderListErrorProps {
  retrying?: boolean;
  onRetry: () => void;
}

export function OrderListError({ retrying, onRetry }: OrderListErrorProps) {
  return (
    <s-page heading="Orders">
      <s-banner tone="critical" heading="Orders could not be loaded">
        <s-paragraph>Check your connection and try again.</s-paragraph>
        <s-button
          slot="secondary-actions"
          onClick={onRetry}
          {...(retrying ? { disabled: true, loading: true } : {})}
        >
          Try again
        </s-button>
      </s-banner>
    </s-page>
  );
}

// A failed page load shows a banner instead of React Router's error page. Responses
// still go to boundary.error, because Shopify's auth throws them and needs their
// content rendered as it is.
//
// Try again navigates to the same URL, which runs the loaders again. Reloading the
// iframe would replace the banner with the browser's error page when offline. A
// revalidation is not enough: React Router only clears the error if the "loading" state
// was rendered, which a fast response can skip, so the banner would stay.
export function OrderListErrorBoundary() {
  const error = useRouteError();
  const location = useLocation();
  const navigate = useNavigate();
  const navigation = useNavigation();

  return isRouteErrorResponse(error) ? (
    boundary.error(error)
  ) : (
    <OrderListError
      retrying={navigation.state !== "idle"}
      onRetry={() => navigate(location, { replace: true })}
    />
  );
}
