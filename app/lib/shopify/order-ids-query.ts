// One page of the shop's order IDs and updatedAt, for the sync of existing orders
// (#21). An order that changed since it was stored is then read with ORDER_QUERY,
// the same query as the webhooks (ADR-0003).
// Test fixtures in test/fixtures/order-ids-page-*.json are responses to this
// query, captured from the development store.
//
// - Without read_all_orders, only orders created in the last 60 days are listed
// - Only scalar fields: the requested cost stays near the page size (250), well
//   under the 1,000 limit for one query
export const ORDER_IDS_QUERY = `#graphql
  query OrderIdsForSync($after: String) {
    orders(first: 250, after: $after) {
      nodes {
        id
        updatedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;
