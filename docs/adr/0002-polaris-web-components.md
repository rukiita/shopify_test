# 0002. Build the UI with Polaris Web Components

- Status: Proposed
- Date: 
- Issue: #14 (DEC-2)

## Context

The task asks for Polaris for the UI. Polaris exists as Web Components and as React (`@shopify/polaris`).

## Options considered

1. Polaris Web Components (the default in the React Router template)
2. Polaris React

## Decision

Option 1 (tentative). The template already uses it, and Shopify has made it generally available as the way forward.
Before accepting, verify in Step 1 that UI tests work with Vitest + Testing Library (jsdom).

## Consequences

- Positive: keeps the template's structure. No extra dependencies
- Negative: fewer examples and resources than Polaris React. Testing in jsdom may work differently from the React version
- Revisit when: UI tests cannot be written, or a needed component (e.g. an index table) is missing

## References

- https://community.shopify.dev/t/shopify-app-template-remix-still-not-using-web-components/23593 (general availability; adopted by the React Router template)
