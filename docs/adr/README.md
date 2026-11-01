# Architecture Decision Records

Records of decisions that shape the architecture. The format is a simplified [MADR](https://adr.github.io/madr/) (`template.md`).

## Process

1. Open a DEC issue for the question (work-in-progress discussion stays in the issue)
2. Open a PR adding the ADR with status `Proposed` (`Closes #n`)
3. Set it to `Accepted` when merging
4. To reverse a decision, do not edit the old ADR. Add a new one and mark the old one `Superseded by ADR-NNNN`

Interpretations of the task (CSV row granularity, which address to use, etc.) are not ADRs; they go in the README under "Interpretation of the task".
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
