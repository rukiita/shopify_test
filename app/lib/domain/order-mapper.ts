import type { LineItem, Order, Product } from "@prisma/client";
import type { ShopifyOrder } from "../shopify/order-query";
import { toMinorUnits } from "./money";

// The rows one ingestion of an order writes.
export interface MappedOrder {
  order: Order;
  lineItems: LineItem[];
  // One per product, even when several line items share it.
  products: Product[];
}

export function mapOrder(shop: string, order: ShopifyOrder): MappedOrder {
  const total = order.currentTotalPriceSet.shopMoney;

  const products = new Map<string, Product>();
  for (const { product } of order.lineItems.nodes) {
    if (product) {
      products.set(product.id, {
        id: product.id,
        shop,
        title: product.title,
        tags: JSON.stringify(product.tags),
        shopifyUpdatedAt: new Date(product.updatedAt),
      });
    }
  }

  return {
    order: {
      id: order.id,
      shop,
      name: order.name,
      number: order.number,
      totalPriceMinor: toMinorUnits(total.amount, total.currencyCode),
      currencyCode: total.currencyCode,
      paymentGateways: JSON.stringify(order.paymentGatewayNames),
      customerEmail: order.email ?? null,
      customerFullName: fullName(order.customer),
      customerAddress: formatAddress(
        order.shippingAddress ?? order.billingAddress,
      ),
      tags: JSON.stringify(order.tags),
      shopifyCreatedAt: new Date(order.createdAt),
      shopifyUpdatedAt: new Date(order.updatedAt),
    },
    lineItems: order.lineItems.nodes.map((lineItem) => ({
      id: lineItem.id,
      orderId: order.id,
      productId: lineItem.product?.id ?? null,
      title: lineItem.title,
      quantity: lineItem.currentQuantity,
    })),
    products: [...products.values()],
  };
}

function fullName(customer: ShopifyOrder["customer"]) {
  const name = [customer?.firstName, customer?.lastName]
    .filter(Boolean)
    .join(" ");
  return name || null;
}

// One line, e.g. "123 Test Street, San Francisco CA 94103, United States".
function formatAddress(address: ShopifyOrder["shippingAddress"]) {
  return address ? address.formatted.join(", ") : null;
}
