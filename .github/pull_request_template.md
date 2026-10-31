## Issue

Closes #

## Changes

-

## Diagram

<!-- Required for complex changes (see CONTRIBUTING.md §5): a flow across 3+ modules, state transitions / event ordering, or database models. Use Mermaid. Otherwise write "Not required". -->

## Why

<!-- The reasoning behind the change. For a decision PR: what was verified and how the decision was made -->

## Testing

<!-- What the author (or Claude) actually ran, and the result. Commands and outcomes, not intentions.
     e.g. `npm test` → 42 passed, 0 failed / `shopify app webhook trigger --topic orders/create` → order stored, checked in Prisma Studio
     For documentation-only changes: what was checked (e.g. "Mermaid renders on GitHub", "links open"). -->

| Who | What was run | Result |
|---|---|---|
|  |  |  |

## Risks

<!-- What could go wrong after merging, and which check would catch it (a test, a manual step, a log, a reviewer).
     If a risk has no check, say so. -->

| Risk | Caught by |
|---|---|
|  |  |

## Rollback

<!-- How to disable or undo this change if it causes a problem.
     Default: `git revert -m 1 <merge commit>` and open a PR. Call out anything a revert does not undo:
     database migrations, data already written, Shopify-side changes (tags, webhook subscriptions, scopes). -->

## Related ADRs

- None / ADR-000n

## Checklist

- [ ] Worked through the issue's test list test-first (Red → Green → Refactor)
- [ ] Commits are split as `test:` → `feat:` / `fix:` → `refactor:`
- [ ] `npm test` passes
- [ ] All acceptance criteria in the issue are met
- [ ] Testing, Risks and Rollback are filled in
- [ ] A diagram is included if CONTRIBUTING.md §5 requires one
- [ ] Any new decision is recorded in an ADR or the README

> Merge with **Create a merge commit** (no squash), so the TDD commits stay in the history.
