// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { OrderTable } from "../../app/components/order-table";
import type { OrderListRow } from "../../app/lib/domain/order-list-row";

afterEach(cleanup);

const noop = () => {};

const order: OrderListRow = {
  id: "gid://shopify/Order/1006",
  name: "#1006",
  createdAt: "2026-11-01T05:17:27.000Z",
  customerName: "Test Buyer",
  customerEmail: "test.buyer@example.com",
  total: "$1,385.95",
  paymentGateways: ["bogus", "manual"],
  tags: ["Snowboard", "VIP"],
};

const props = {
  timeZone: "UTC",
  loading: false,
  hasNextPage: false,
  hasPreviousPage: false,
  onNextPage: noop,
  onPreviousPage: noop,
};

const cellText = (row: Element) =>
  [...row.querySelectorAll("s-table-cell")].map((cell) => cell.textContent);

it("BE-2 Order list : 1. the table shows each order's columns, in the order given", () => {
  const { container } = render(
    <OrderTable
      {...props}
      orders={[order, { ...order, id: "gid://shopify/Order/1005", name: "#1005" }]}
    />,
  );

  const headers = [...container.querySelectorAll("s-table-header")];
  expect(headers.map((header) => header.textContent)).toEqual([
    "Order",
    "Created at",
    "Customer",
    "Email",
    "Total",
    "Payment gateway",
    "Tags",
  ]);

  const rows = container.querySelectorAll("s-table-body s-table-row");
  expect(rows).toHaveLength(2);
  expect(cellText(rows[0])).toEqual([
    "#1006",
    "Nov 1, 2026, 5:17 AM",
    "Test Buyer",
    "test.buyer@example.com",
    "$1,385.95",
    "bogus, manual",
    "Snowboard, VIP",
  ]);
  expect(cellText(rows[1])[0]).toBe("#1005");
});

it("BE-2 Order list : 1. a column with no value shows a dash", () => {
  const { container } = render(
    <OrderTable
      {...props}
      orders={[
        {
          ...order,
          customerName: null,
          customerEmail: null,
          paymentGateways: [],
          tags: [],
        },
      ]}
    />,
  );

  const row = container.querySelector("s-table-body s-table-row");
  expect(cellText(row!)).toEqual([
    "#1006",
    "Nov 1, 2026, 5:17 AM",
    "—",
    "—",
    "$1,385.95",
    "—",
    "—",
  ]);
});

it("BE-2 Order list : 1. nextpage and previouspage events call the handlers, and page availability is set on the table", () => {
  const calls: string[] = [];
  const pagination = {
    onNextPage: () => calls.push("next"),
    onPreviousPage: () => calls.push("previous"),
  };
  const { container, rerender } = render(
    <OrderTable
      {...props}
      {...pagination}
      orders={[order]}
      hasNextPage
      hasPreviousPage={false}
    />,
  );
  // Properties: React 18 would write hasNextPage={false} as the attribute "false".
  const table = () => container.querySelector("s-table")!;
  expect(table().paginate).toBe(true);
  expect(table().hasNextPage).toBe(true);
  expect(table().hasPreviousPage).toBe(false);
  expect(table().loading).toBe(false);

  // Polaris dispatches these on the element itself; they do not bubble.
  table().dispatchEvent(new Event("nextpage"));
  table().dispatchEvent(new Event("previouspage"));
  expect(calls).toEqual(["next", "previous"]);

  rerender(
    <OrderTable
      {...props}
      {...pagination}
      orders={[order]}
      hasNextPage={false}
      hasPreviousPage
      loading
    />,
  );
  expect(table().hasNextPage).toBe(false);
  expect(table().hasPreviousPage).toBe(true);
  expect(table().loading).toBe(true);

  // One handler per event after a rerender, not one per render.
  table().dispatchEvent(new Event("nextpage"));
  expect(calls).toEqual(["next", "previous", "next"]);
});

it("BE-2 Order list : 1. a single page of orders has no pagination controls", () => {
  const { container } = render(<OrderTable {...props} orders={[order]} />);

  expect(container.querySelector("s-table")?.paginate).toBe(false);
});
