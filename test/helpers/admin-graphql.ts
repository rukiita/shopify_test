import { setAbstractFetchFunc } from "@shopify/shopify-api/runtime";
import { apiVersion } from "../../app/shopify.server";

interface GraphqlRequestBody {
  query: string;
  variables?: Record<string, unknown>;
}

// Replaces the HTTP call behind `admin.graphql` (ADR-0006: only `admin.graphql` is
// replaced; `authenticate.webhook` runs for real). The Shopify API library captures
// `fetch` when it is imported, so `vi.stubGlobal("fetch")` would not reach it.
//
// Every Admin GraphQL request to `shop` gets `response` (a fixture), or what
// `response` returns (or resolves to) for the request's variables and query when it is
// a function. A `Response` is sent as it is, to give an HTTP status other than 200.
// Any other request throws. Returns the bodies sent, so a test can check the
// variables.
type Responder = (variables: Record<string, unknown>, query: string) => unknown;

export function mockAdminGraphql(shop: string, response: object | Responder) {
  const endpoint = `https://${shop}/admin/api/${apiVersion}/graphql.json`;
  const requests: GraphqlRequestBody[] = [];

  setAbstractFetchFunc(async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url !== endpoint || init?.method !== "POST") {
      throw new Error(`Unexpected request in a test: ${init?.method} ${url}`);
    }
    const body: GraphqlRequestBody = JSON.parse(String(init.body));
    requests.push(body);
    const responseBody =
      typeof response === "function"
        ? await (response as Responder)(body.variables ?? {}, body.query)
        : response;
    if (responseBody instanceof Response) {
      return responseBody;
    }
    return new Response(JSON.stringify(responseBody), {
      headers: { "Content-Type": "application/json" },
    });
  });

  return requests;
}

// Call in `afterEach`. Tests never reach the network: requests throw until the
// next `mockAdminGraphql`.
export function resetAdminGraphql() {
  setAbstractFetchFunc(async (input) => {
    throw new Error(`Unexpected request in a test: ${String(input)}`);
  });
}
