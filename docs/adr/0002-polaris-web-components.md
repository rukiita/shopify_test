# 0002. Build the UI with Polaris Web Components

- Status: Accepted
- Date: 2026-10-31
- Issue: #14 (DEC-2)

## Context

The task asks for Polaris for the UI. Polaris exists as Web Components and as React (`@shopify/polaris`).

Polaris React is deprecated. Shopify released Polaris Web Components on October 1, 2025, recommends them for new app development, and no longer updates or maintains the React library.

## Options considered

1. Polaris Web Components (the default in the React Router template)
2. Polaris React

## Decision

Option 1.

- Polaris React receives no updates or maintenance. Starting a new app on it would build in a migration from day one, and would be hard to justify to a reviewer.
- The components this app needs exist. `s-table` covers the order list, including loading state and cursor pagination, which is the shape of BE-2. Shopify publishes migration guides from DataTable and IndexTable to `s-table`.
- The React Router template already uses Web Components, so no extra dependency is added.

How the UI is tested is a separate question, recorded in ADR-0006.

## Consequences

- Positive: follows Shopify's current direction and the template's structure. No extra dependencies
- Negative: fewer examples and community answers than Polaris React. Testing Web Components in jsdom is not documented by Shopify (handled in ADR-0006)
- Revisit when: a needed component is missing. The fallback is to compose it from basic `s-` components, not to return to Polaris React

## References

- https://raw.githubusercontent.com/Shopify/polaris/HEAD/README.md (Polaris React deprecated; Web Components released October 1, 2025)
- https://shopify.github.io/polaris-react-archive/ (Polaris React in maintenance mode)
- https://shopify.dev/docs/api/app-home/polaris-web-components/layout-and-structure/table (`s-table`)
- https://shopify.dev/docs/apps/build/app-home/migrate-from-polaris-react/data-table (DataTable → `s-table`, with cursor pagination)
