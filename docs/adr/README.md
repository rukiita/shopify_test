# Architecture Decision Records

Records of decisions that shape the architecture. The format is a simplified [MADR](https://adr.github.io/madr/) (`template.md`).

## Process

1. Open a DEC issue for the question (work-in-progress discussion stays in the issue)
2. Open a PR adding the ADR with status `Proposed` (`Closes #n`)
3. Set it to `Accepted` when merging
4. To reverse a decision, do not edit the old ADR. Add a new one and mark the old one `Superseded by ADR-NNNN`

Interpretations of the task (CSV row granularity, which address to use, etc.) are not ADRs; they go in `docs/interpretation.md`, with a summary in the README under "Interpretation of the task".
Code-level choices go in code comments.

## Index

| No. | Title | Status | Issue |
|---|---|---|---|
| [0001](0001-react-router-template.md) | Build on the React Router v7 app template | Accepted | #13 |
| [0002](0002-polaris-web-components.md) | Build the UI with Polaris Web Components | Accepted | #14 |
| [0003](0003-refetch-order-via-graphql.md) | Use webhooks as triggers and refetch orders via GraphQL | Accepted | #15 |
| [0004](0004-sync-tags-to-shopify.md) | Write order tags to Shopify as the single source of truth | Accepted | #16 |
| [0005](0005-process-webhooks-synchronously.md) | Process webhooks synchronously within the request | Accepted | #17 |
| [0006](0006-tdd.md) | Develop with TDD and merge PRs with merge commits | Accepted | #22 |

## Implementation choices

Design decisions are recorded as Architecture Decision Records in [docs/adr/](README.md). Each ADR holds the options considered and the full reasoning. This table is a summary.

| ADR | Decision | Why |
|---|---|---|
| [0001](0001-react-router-template.md) | Build on the React Router v7 app template | The task prefers Node.js or Remix. React Router v7 is Remix's successor and Shopify's current template, while the Remix package gets only critical security fixes |
| [0002](0002-polaris-web-components.md) | Build the UI with Polaris Web Components | Polaris React receives no more updates, and the template already uses Web Components |
| [0003](0003-refetch-order-via-graphql.md) | Use webhooks as triggers and refetch each order via GraphQL | The webhook payload has no product tags, so a fetch is needed anyway. Refetching the whole order leaves one data source and one mapping |
| [0004](0004-sync-tags-to-shopify.md) | Write order tags to Shopify, not only to the app's database | Shopify owns the data. A tag stored only in the app would disappear on the next refetch of the order |
| [0005](0005-process-webhooks-synchronously.md) | Process webhooks within the request, not from a queue | One delivery takes about 0.5 s against Shopify's 5-second limit, and reviewers can run the app without a worker or Redis. Production would use a queue |
| [0006](0006-tdd.md) | Develop with TDD and merge pull requests with merge commits | The core logic is easy to test first, and the commits show how the work was done. The UI has only thin tests, and Shopify configuration is checked by hand |
