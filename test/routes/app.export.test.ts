import type { LoaderFunctionArgs } from "react-router";
import { beforeEach, expect, it } from "vitest";
import { mapOrder } from "../../app/lib/domain/order-mapper";
import { saveOrder } from "../../app/lib/repositories/order-repository.server";
import { loader } from "../../app/routes/app.export";
import { csvLines } from "../helpers/csv";
import { resetDatabase } from "../helpers/database";
import {
  fixtureOrder,
  fixtures,
  orderWithLineItems,
} from "../helpers/order-fixtures";
import { createOfflineSession } from "../helpers/session";
import { adminRequest, sessionToken } from "../helpers/session-token";

const SHOP = "test-shop.myshopify.com";
const OTHER_SHOP = "other-shop.myshopify.com";

beforeEach(async () => {
  await resetDatabase();
  await createOfflineSession(SHOP);
  await createOfflineSession(OTHER_SHOP);
});

const load = (request: Request) =>
  loader({ request, params: {}, context: {} } as LoaderFunctionArgs);

it("BE-5 CSV export : 1. the loader returns the shop's orders as a CSV download", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));
  await saveOrder(mapOrder(OTHER_SHOP, fixtureOrder(fixtures.noCustomer)));

  const response = await load(
    adminRequest("/app/export", sessionToken(SHOP), "GET"),
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
  expect(response.headers.get("Content-Disposition")).toBe(
    'attachment; filename="orders.csv"',
  );
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  // Decoded by hand: response.text() would remove the BOM.
  const body = new TextDecoder("utf-8", { ignoreBOM: true }).decode(
    await response.arrayBuffer(),
  );
  const order =
    '6663058751643,1006,1385.95,bogus,test.buyer+1@example.com,Test Buyer,"123 Test Street, Apt 4, Building B, San Francisco CA 94103, United States",Snowboard,2026-11-01T05:17:27Z';
  expect(body).toBe(
    "\uFEFF" +
      [
        "Order id,Order number,Total price,Payment gateway,Customer email,Customer full name,Customer address,Tags,Created at,Product title,Product tags",
        `${order},The Compare at Price Snowboard,"Accessory, Sport, Winter"`,
        `${order},The Collection Snowboard: Hydrogen Changed,"Accessory, Snowboard, Sport, Winter"`,
      ].join("\r\n") +
      "\r\n",
  );
});

it("BE-5 CSV export : 1. the loader rejects a request without a valid session token", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.regular)));

  const thrown = await load(
    adminRequest(
      "/app/export",
      sessionToken(SHOP, "not-the-app-secret"),
      "GET",
    ),
  ).catch((failure: unknown) => failure);

  expect((thrown as Response).status).toBe(401);
});

it("BE-5 CSV export : 1. the loader's file has no formula at the start of a part split on semicolons and line breaks", async () => {
  const fixture = fixtureOrder(fixtures.regular);
  for (const firstName of ["x;=1+1;y", "before\n=1+1", 'x;"=1+1']) {
    await saveOrder(
      mapOrder(SHOP, {
        ...fixture,
        customer: { firstName, lastName: "Buyer" },
      }),
    );

    const response = await load(
      adminRequest("/app/export", sessionToken(SHOP), "GET"),
    );

    // How a spreadsheet with ; as its separator cuts the file: commas do not split a
    // line there, so a value's opening quote is in the middle of a cell.
    const parts = (await response.text()).split(/[;\r\n]+/);
    expect(parts.filter((part) => /^"*[=+\-@]/.test(part))).toEqual([]);
  }
});

it("BE-5 CSV export : 1. the loader writes a row for each of an order's 51 line items", async () => {
  await saveOrder(mapOrder(SHOP, orderWithLineItems(fixtures.regular, 51)));

  const response = await load(
    adminRequest("/app/export", sessionToken(SHOP), "GET"),
  );

  const [, ...rows] = csvLines(await response.text());
  const titles = rows.map((row) => /,(Product \d+),/.exec(row)?.[1]);
  expect(titles.sort()).toEqual(
    Array.from({ length: 51 }, (_, index) => `Product ${index + 1}`).sort(),
  );
});

it("BE-5 CSV export : 4. the loader writes a fully refunded order as one row with a total of 0 and empty product columns", async () => {
  await saveOrder(mapOrder(SHOP, fixtureOrder(fixtures.refunded)));

  const response = await load(
    adminRequest("/app/export", sessionToken(SHOP), "GET"),
  );

  const [, ...rows] = csvLines(await response.text());
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatch(/^6667485380763,1056,0\.00,bogus,.*,,$/);
});
