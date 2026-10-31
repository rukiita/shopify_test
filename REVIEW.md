# Code review

How pull requests in this repository are reviewed. Process rules for writing code are in [CONTRIBUTING.md](CONTRIBUTING.md); design decisions are in [docs/adr/](docs/adr/README.md).

## 1. Who reviews

- **The reviewer is never the agent that wrote the code.** Use a separate agent or a fresh subagent that did not take part in writing the change.
- Give the reviewer only what a human reviewer would have: the PR diff, the linked issue, this file, `CONTRIBUTING.md` and the ADRs. Not the author's conversation or reasoning.
- The review informs the author. **Merging is always the author's decision.**

### Running it with `/code-review`

1. Open a **new Claude Code session** (not the one that wrote the change) and run `/code-review <PR number>`.
2. `/code-review` looks for general correctness bugs. It does not read this file, but it follows `CLAUDE.md`, which tells it to read §2–§3 here. So the same run also checks the focus areas in §2 and reports in the §3 format.
3. Do **not** pass `--fix`. The author fixes (§4); a reviewer that fixes its own findings would also be verifying its own fix.
4. `/code-review` gives a category but no severity. The reviewer assigns one per §3.

> `REVIEW.md` is also the file the managed Code Review service on GitHub reads. This project does not use that service. If it is adopted later, move the process rules (§1, §4, §5) to `CONTRIBUTING.md` so that this file holds only review criteria.

## 2. What to look for

Check these first. They are the bugs most likely to slip through in this app.

| Area | Look for | Related |
|---|---|---|
| Webhook ingestion | The same delivery twice creates no duplicates. A stale `orders/updated` cannot overwrite newer data (`updatedAt` check). A failed GraphQL fetch returns non-2xx so Shopify retries | BE-1, ADR-0003 |
| Data from Shopify | `null` is handled where Shopify allows it: `customer`, `shippingAddress`, `billingAddress`, `lineItem.product`. GIDs and numeric IDs are not mixed. Money stays a string or decimal, never a float | BE-1, BE-6 |
| Tag edits | `tagsAdd` / `tagsRemove`, never `orderUpdate`. Shopify is written first; the database changes only on success. `userErrors` leave the database unchanged. Input goes through `normalizeTag` | BE-3, BE-4, ADR-0004 |
| CSV | RFC 4180 escaping. Column order matches the CSV template plus Product title / Product tags. Format follows "Interpretation of the task" in the README | BE-5, README |
| Tests | The outer acceptance test exists. Names follow `docs/requirements.md`. Fixtures come from real responses. Prisma is not mocked. `test:` commits come before the matching `feat:` commits | ADR-0006 |
| Decisions | The change does not contradict an Accepted ADR. A new decision has an ADR or a README entry | `docs/adr/` |

Security is reviewed separately with [SECURITY_REVIEW.md](SECURITY_REVIEW.md): webhook signature verification, shop isolation, customer data and the other security checks live there, not here.

## 3. How to report a finding

Every finding has all of the following. A finding without a failure scenario is a question, not a finding.

| Field | Content |
|---|---|
| Location | `path/to/file.ts:42` |
| Problem | One sentence |
| Failure scenario | Concrete input or state → the wrong result. e.g. "an order with `customer: null` → `order-mapper` throws, the webhook returns 500, Shopify retries forever" |
| Evidence | One of: a failing test (name and output), a command and its output, a line of an ADR / doc / Shopify doc with a link. Mark it **Verified** (reproduced) or **Suspected** (read from the code only) |
| Severity | **Blocker**: wrong data, data loss, security, or a requirement not met. **Major**: a likely bug or a missing test for a requirement. **Minor**: an edge case or maintainability. **Nit**: style; never blocks |
| Suggested fix | Optional, but preferred |

Example:

> **Major — Suspected** · `app/lib/domain/order-mapper.ts:31`
> `shippingAddress.address1` is read without a null check.
> Failure scenario: a digital-goods order has `shippingAddress: null` → mapping throws → webhook returns 500.
> Evidence: README "Interpretation of the task" expects a billing fallback; no fixture covers `shippingAddress: null`.
> Suggested fix: fall back to `billingAddress`; add a fixture and a test.

## 4. Fix and re-verify: one round

1. The reviewer reports findings.
2. The author fixes **once**.
3. The reviewer re-verifies **once**, checking each finding: resolved / not resolved, with evidence.
4. If every Blocker and Major is resolved, the review is complete. Stop. The author checks the code review item in the PR checklist.
5. If not, **stop anyway.** Do not start another round. Report:
   - the fixes that were tried
   - the verification result for each finding
   - the problems that remain, with their severity

The author then decides what to do (merge with a follow-up issue, rework, or close).

The count never resets. New commits, a rebase or a new review request on the same PR are still the same round.

## 5. Turning recurring findings into rules

When the same kind of finding appears a second time, encode it so it cannot recur, in the cheapest place that catches it:

| Where | When |
|---|---|
| Lint rule | It can be detected from the code alone (e.g. `orderUpdate` used for tags, floats for money) |
| Test or test helper | It needs data to show (e.g. a fixture with `customer: null`) |
| `CLAUDE.md` / `CONTRIBUTING.md` / this file | It is a process or judgment rule |
| A Claude skill | It is a repeatable multi-step procedure |

Record it in the log below in the same PR that adds the rule.

### Recurring findings log

| Finding | Seen in | Encoded as |
|---|---|---|
| _(none yet)_ | | |
