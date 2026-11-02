import { useEffect, useRef, type ReactNode } from "react";
import {
  formatOrderDate,
  type OrderListRow,
} from "../lib/domain/order-list-row";

interface OrderTableProps {
  orders: OrderListRow[];
  // The time zone to show the created time in.
  timeZone: string;
  // Shown with the empty state, to get orders into the list.
  emptyAction: ReactNode;
  loading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

// The order list (#2). Presentational: the page owns the data and the navigation.
export function OrderTable(props: OrderTableProps) {
  return props.orders.length > 0 ? (
    <PagedTable {...props} />
  ) : (
    <NoOrders action={props.emptyAction} />
  );
}

function NoOrders({ action }: { action: ReactNode }) {
  return (
    <s-box padding="base">
      <s-stack direction="block" gap="base">
        <s-stack direction="block" gap="small-200">
          <s-heading>No orders yet</s-heading>
          <s-paragraph>
            New orders appear here when they are placed or changed in your
            store. Sync imports the orders from the last 60 days.
          </s-paragraph>
        </s-stack>
        {action}
      </s-stack>
    </s-box>
  );
}

function PagedTable({
  orders,
  timeZone,
  loading,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
}: OrderTableProps) {
  const table = useRef<HTMLElementTagNameMap["s-table"]>(null);

  // Listened to here because React 18 does not bind `onNextPage` on a custom element.
  // Polaris does once its script runs, but it never runs in the tests.
  useEffect(() => {
    const element = table.current!;
    element.addEventListener("nextpage", onNextPage);
    element.addEventListener("previouspage", onPreviousPage);
    return () => {
      element.removeEventListener("nextpage", onNextPage);
      element.removeEventListener("previouspage", onPreviousPage);
    };
  }, [onNextPage, onPreviousPage]);

  return (
    // The attributes are only added when true: React 18 writes false as the attribute
    // "false", which still reads as true. In JSX, not set on the element from an effect:
    // Polaris drops the first write to a hydrated element, and a server render has them.
    <s-table
      ref={table}
      variant="auto"
      {...(hasNextPage || hasPreviousPage ? { paginate: true } : {})}
      {...(loading ? { loading: true } : {})}
      {...(hasNextPage ? { hasNextPage: true } : {})}
      {...(hasPreviousPage ? { hasPreviousPage: true } : {})}
    >
      <s-table-header-row>
        <s-table-header listSlot="primary">Order</s-table-header>
        <s-table-header listSlot="labeled">Created at</s-table-header>
        <s-table-header listSlot="secondary">Customer</s-table-header>
        <s-table-header listSlot="labeled">Email</s-table-header>
        <s-table-header listSlot="labeled" format="currency">
          Total
        </s-table-header>
        <s-table-header listSlot="labeled">Payment gateway</s-table-header>
        <s-table-header listSlot="labeled">Tags</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {orders.map((order) => (
          <s-table-row key={order.id}>
            <s-table-cell>{order.name}</s-table-cell>
            <s-table-cell>
              {formatOrderDate(order.createdAt, timeZone)}
            </s-table-cell>
            <s-table-cell>{order.customerName ?? NO_VALUE}</s-table-cell>
            <s-table-cell>{order.customerEmail ?? NO_VALUE}</s-table-cell>
            <s-table-cell>{order.total}</s-table-cell>
            <s-table-cell>{list(order.paymentGateways)}</s-table-cell>
            <s-table-cell>{list(order.tags)}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

const NO_VALUE = "—";

const list = (values: string[]) => values.join(", ") || NO_VALUE;
