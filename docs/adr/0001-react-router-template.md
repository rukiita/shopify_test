# 0001. Build on the React Router v7 app template

- Status: Accepted
- Date: 2026-10-30
- Issue: #13 (DEC-1)

## Context

The task lists "Node.js or Remix" as the preferred stack.
Meanwhile, Shopify now directs new apps to its React Router template, since Remix has merged into React Router v7.

## Options considered

1. React Router v7 template (`shopify-app-template-react-router`)
2. Remix template (`shopify-app-template-remix`)
3. Plain Node.js (e.g. Express) from scratch

## Decision

Option 1. It is the successor to Remix and meets the intent behind "Remix" in the task: building on Shopify's standard stack.
Option 2 is not chosen for new work because support for the Remix package is limited to critical security fixes.
Option 3 would mean building OAuth, sessions and webhook signature verification by hand, which is outside the point of the task.

## Consequences

- Positive: authentication, sessions (Prisma) and webhook verification (`authenticate.webhook`) come with the template. The structure matches Shopify's current docs and examples
- Negative: it differs from the wording of the task (Remix), so the README needs to explain it
- Revisit when: the reviewer explicitly requires Remix

## References

- https://github.com/Shopify/shopify-app-template-remix (directs new projects to the React Router template)
- https://github.com/Shopify/shopify-app-template-react-router/wiki/Upgrading-from-Remix (scope of continued Remix support)
