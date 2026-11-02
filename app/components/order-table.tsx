import { useEffect, useRef } from "react";
import {
  formatOrderDate,
  type OrderListRow,
} from "../lib/domain/order-list-row";

interface OrderTableProps {
  orders: OrderListRow[];
  // The time zone to show the created time in.
  timeZone: string;
  loading: boolean;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNextPage: () => void;
  onPreviousPage: () => void;
}

// The order list (#2). Presentational: the page owns the data and the navigation.
export function OrderTable({
  orders,
  timeZone,
  loading,
  hasNextPage,
  hasPreviousPage,
  onNextPage,
  onPreviousPage,
}: OrderTableProps) {
  const table = useRef<HTMLElementTagNameMap["s-table"]>(null);

  // React 18 writes every prop of a custom element as an attribute, so false would
  // become the attribute "false", and it does not listen to `onNextPage` at all. So
  // these are set on the element directly.
  useEffect(() => {
    const element = table.current!;
    element.paginate = hasNextPage || hasPreviousPage;
    element.loading = loading;
    element.hasNextPage = hasNextPage;
    element.hasPreviousPage = hasPreviousPage;
  }, [loading, hasNextPage, hasPreviousPage]);

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
    <s-table ref={table} variant="auto">
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
