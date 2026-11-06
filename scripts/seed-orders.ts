// Creates 53 test orders in a development store, so a reviewer can see the
// order list's later pages (25 orders per page) without placing orders by hand
// (#120).
//
//   npx shopify store auth --store <store>.myshopify.com --scopes read_products,write_draft_orders,read_orders
//   npm run seed:orders -- --store <store>.myshopify.com
//
// It runs Shopify CLI's `store execute` with the token that `store auth`
// stored, not with the app's token, so the app's code and scopes do not change.
// Each order is a draft order that is then completed: `orderCreate` allows only
// five new orders per minute on a development store.
import { execFile } from "node:child_process";
import { pathToFileURL } from "node:url";

export const SEED_ORDER_COUNT = 53;
export const SEED_TAG = "seed";
const DEFAULT_CONCURRENCY = 5;

export const PRODUCTS_QUERY = `query SeedProducts { products(first: 20, query: "status:active AND gift_card:false") { nodes { title variants(first: 1) { nodes { id } } } } }`;
export const DRAFT_ORDER_CREATE = `mutation SeedDraftOrderCreate($input: DraftOrderInput!) { draftOrderCreate(input: $input) { draftOrder { id } userErrors { field message } } }`;
export const DRAFT_ORDER_COMPLETE = `mutation SeedDraftOrderComplete($id: ID!) { draftOrderComplete(id: $id) { draftOrder { order { id name } } userErrors { field message } } }`;

export type Execute = (
  query: string,
  variables?: Record<string, unknown>,
) => Promise<unknown>;

export type DraftOrderInput = {
  email: string;
  tags: string[];
  lineItems: { variantId: string; quantity: number }[];
  shippingAddress: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    provinceCode: string;
    countryCode: string;
    zip: string;
  };
};

export type SeededOrder = { id: string; name: string };

type UserError = { field: string[] | null; message: string };

type ProductsResponse = {
  data: { products: { nodes: { variants: { nodes: { id: string }[] } }[] } };
};
type DraftOrderCreateResponse = {
  data: {
    draftOrderCreate: {
      draftOrder: { id: string } | null;
      userErrors: UserError[];
    };
  };
};
type DraftOrderCompleteResponse = {
  data: {
    draftOrderComplete: {
      draftOrder: { order: SeededOrder | null } | null;
      userErrors: UserError[];
    };
  };
};

// The first variant of each active product that is not a gift card.
export function readVariantIds(response: unknown): string[] {
  return (response as ProductsResponse).data.products.nodes.flatMap((product) =>
    product.variants.nodes.slice(0, 1).map((variant) => variant.id),
  );
}

// One line item per order, taking the variants in turn. Each order has its own
// test customer: Shopify creates the customer from the email and the shipping
// address's name when the draft order is completed.
export function buildDraftOrderInputs(
  variantIds: string[],
  count = SEED_ORDER_COUNT,
): DraftOrderInput[] {
  if (variantIds.length === 0) {
    throw new Error(
      "The store has no active products to order. Create the store with demo data, or add a product",
    );
  }
  return Array.from({ length: count }, (_, index) => {
    const n = index + 1;
    return {
      email: `seed-buyer-${n}@example.com`,
      tags: [SEED_TAG],
      lineItems: [
        { variantId: variantIds[index % variantIds.length], quantity: 1 },
      ],
      shippingAddress: {
        firstName: "Seed",
        lastName: `Buyer ${n}`,
        address1: `${n} Test Street`,
        city: "Austin",
        provinceCode: "TX",
        countryCode: "US",
        zip: "78701",
      },
    };
  });
}

function throwOnUserErrors(step: string, userErrors: UserError[]) {
  if (userErrors.length > 0) {
    throw new Error(
      `${step}: ${userErrors.map((error) => error.message).join("; ")}`,
    );
  }
}

export function readDraftOrderId(response: unknown): string {
  const payload = (response as DraftOrderCreateResponse).data.draftOrderCreate;
  throwOnUserErrors("draftOrderCreate", payload.userErrors);
  if (!payload.draftOrder)
    throw new Error("draftOrderCreate returned no draft order");
  return payload.draftOrder.id;
}

export function readOrder(response: unknown): SeededOrder {
  const payload = (response as DraftOrderCompleteResponse).data
    .draftOrderComplete;
  throwOnUserErrors("draftOrderComplete", payload.userErrors);
  const order = payload.draftOrder?.order;
  if (!order) throw new Error("draftOrderComplete returned no order");
  return { id: order.id, name: order.name };
}

// `shopify store execute --json` exits with 1 and prints
// {"error": {"message", "details": {"errors": [{"message"}]}}} on stdout.
export function readCliError(stdout: string): string | undefined {
  try {
    const { error } = JSON.parse(stdout) as {
      error?: {
        message?: string;
        details?: { errors?: { message: string }[] };
      };
    };
    const messages = error?.details?.errors?.map((detail) => detail.message);
    return messages?.length ? messages.join("; ") : error?.message;
  } catch {
    return undefined;
  }
}

export type SeedResult = { created: SeededOrder[]; error?: string };

// Creates the orders a few at a time. Most of the time per order is the CLI
// starting up, not the API. After the first error no new order is started, and
// the orders created so far are reported.
export async function seedOrders({
  execute,
  count = SEED_ORDER_COUNT,
  concurrency = DEFAULT_CONCURRENCY,
  onOrder,
}: {
  execute: Execute;
  count?: number;
  concurrency?: number;
  onOrder?: (order: SeededOrder, created: number) => void;
}): Promise<SeedResult> {
  const inputs = buildDraftOrderInputs(
    readVariantIds(await execute(PRODUCTS_QUERY)),
    count,
  );
  const created: SeededOrder[] = [];
  let error: string | undefined;
  let next = 0;

  const worker = async () => {
    while (error === undefined && next < inputs.length) {
      const input = inputs[next++];
      let draftOrderId: string | undefined;
      try {
        draftOrderId = readDraftOrderId(
          await execute(DRAFT_ORDER_CREATE, { input }),
        );
        const order = readOrder(
          await execute(DRAFT_ORDER_COMPLETE, { id: draftOrderId }),
        );
        created.push(order);
        onOrder?.(order, created.length);
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        error ??= draftOrderId
          ? `${message} (draft order ${draftOrderId} was created but not completed)`
          : message;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, inputs.length) }, worker),
  );
  return { created, error };
}

const STORE_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function parseStore(args: string[]): string {
  const index = args.findIndex(
    (arg) => arg === "--store" || arg.startsWith("--store="),
  );
  const store =
    index === -1
      ? undefined
      : args[index].includes("=")
        ? args[index].slice("--store=".length)
        : args[index + 1];
  if (!store) {
    throw new Error(
      "Usage: npm run seed:orders -- --store <store>.myshopify.com",
    );
  }
  if (!STORE_PATTERN.test(store)) {
    throw new Error(
      `--store must be a myshopify.com domain, e.g. my-dev-store.myshopify.com (got "${store}")`,
    );
  }
  return store;
}

// Runs `shopify store execute`. Under `npm run`, node_modules/.bin is on the
// PATH, so this is the project's Shopify CLI.
function storeExecute(store: string): Execute {
  return (query, variables) =>
    new Promise((resolve, reject) => {
      const args = [
        "store",
        "execute",
        "--store",
        store,
        "--json",
        "--query",
        query,
      ];
      if (variables) args.push("--variables", JSON.stringify(variables));
      if (query.startsWith("mutation")) args.push("--allow-mutations");
      execFile(
        "shopify",
        args,
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout, stderr) => {
          if (error) {
            const lastLine = stderr.trim().split("\n").at(-1);
            reject(
              new Error(readCliError(stdout) ?? lastLine ?? error.message),
            );
            return;
          }
          resolve(JSON.parse(stdout));
        },
      );
    });
}

async function main() {
  const store = parseStore(process.argv.slice(2));
  console.log(
    `Creating ${SEED_ORDER_COUNT} orders tagged "${SEED_TAG}" in ${store}`,
  );
  const started = Date.now();
  const result = await seedOrders({
    execute: storeExecute(store),
    onOrder: (order, created) =>
      console.log(`${created}/${SEED_ORDER_COUNT} ${order.name}`),
  });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (result.error) {
    console.error(
      `Stopped after ${result.created.length} orders (${seconds} s): ${result.error}`,
    );
    process.exitCode = 1;
    return;
  }
  console.log(`Created ${result.created.length} orders in ${seconds} s`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
