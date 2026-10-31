// @vitest-environment jsdom
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

// Checks that a component built from Polaris Web Components can be asserted in
// jsdom (ADR-0006). Polaris' script does not run here, so the `s-` elements are
// never upgraded: the test reads text and attributes, not roles or behaviour.

afterEach(cleanup);

interface SampleRow {
  id: string;
  name: string;
  tags: string[];
}

function SampleTable({ rows }: { rows: SampleRow[] }) {
  return (
    <s-table variant="auto">
      <s-table-header-row>
        <s-table-header listSlot="primary">Order</s-table-header>
        <s-table-header>Tags</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {rows.map((row) => (
          <s-table-row key={row.id} data-order-id={row.id}>
            <s-table-cell>{row.name}</s-table-cell>
            <s-table-cell>{row.tags.join(", ")}</s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}

it("BE-7 Whole app : 2. an s-table renders its rows, cell text and attributes in jsdom", () => {
  const { container } = render(
    <SampleTable
      rows={[
        { id: "1001", name: "#1001", tags: ["gift", "vip"] },
        { id: "1002", name: "#1002", tags: [] },
      ]}
    />,
  );

  const table = container.querySelector("s-table");
  expect(table?.getAttribute("variant")).toBe("auto");
  // React 18 writes custom element props as attributes; HTML lowercases the name.
  expect(container.querySelector("s-table-header")?.getAttribute("listslot")).toBe("primary");

  const rows = container.querySelectorAll("s-table-body s-table-row");
  expect(rows).toHaveLength(2);
  expect(rows[0].getAttribute("data-order-id")).toBe("1001");

  const firstRowCells = rows[0].querySelectorAll("s-table-cell");
  expect(firstRowCells[0].textContent).toBe("#1001");
  expect(firstRowCells[1].textContent).toBe("gift, vip");
  expect(within(rows[1] as HTMLElement).getByText("#1002")).toBeTruthy();
});
