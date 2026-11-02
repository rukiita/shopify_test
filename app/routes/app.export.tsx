import type { LoaderFunctionArgs } from "react-router";
import { buildOrdersCsv } from "../lib/domain/orders-csv";
import { listOrdersForExport } from "../lib/repositories/order-repository.server";
import { authenticate } from "../shopify.server";

// The CSV export (#5). Reads the app's copy of the orders, so it makes no Shopify API
// call. There is no page here: the order list fetches this and saves the response.
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const orders = await listOrdersForExport(session.shop);

  return new Response(buildOrdersCsv(orders), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      // The file has customer details.
      "Cache-Control": "no-store",
    },
  });
};
