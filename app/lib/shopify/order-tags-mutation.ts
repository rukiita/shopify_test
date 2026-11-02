// Returns the order's tags and updatedAt after the write, so the stored copy can take
// both from Shopify. Test fixtures in test/fixtures/tags-*.json are responses to these
// mutations, captured from the development store.
export const ADD_ORDER_TAG_MUTATION = `#graphql
  mutation AddOrderTag($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node {
        ... on Order {
          id
          tags
          updatedAt
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;
