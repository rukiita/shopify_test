# Requirements

Each requirement in the task description has an ID and a matching GitHub issue.

- **Progress is tracked in issues.** This table does not hold status
- Interpretation and acceptance criteria live in each issue
- Design decisions live in `docs/adr/`; interpretation of the task lives in the README ("Interpretation of the task")

Issue numbers are the ones assigned when `scripts/bootstrap-issues.sh` runs on a fresh repository.
The script stops if any issue or PR already exists, so the numbers cannot drift.
DEC-7 (#22) and #23–#24 were added later, so their numbers do not follow their groups.

---

## Functional requirements

| ID | Issue | Requirement | Task description | Milestone |
|---|---|---|---|---|
| BE-1 | #1 | Create/update orders from webhooks | Create/update orders to app database base on Store webhook | Step 3 |
| BE-2 | #2 | Order list UI | Create user-friendly interface that displays list of orders | Step 4 |
| BE-3 | #3 | Add tag | Allow merchants to add tag to an order | Step 5 |
| BE-4 | #4 | Remove tag | (Allow merchants to) remove tag from an order | Step 5 |
| BE-5 | #5 | CSV export | Allow merchants to export orders to a CSV file (9 fields in the CSV template, plus Product title / Product tags) | Step 6 |
| BE-6 | #6 | Fields not in the order JSON | Need some fields not in order/id/.json: Product title, Product tags | Step 3 |

BE-3 and BE-4 are one sentence in the task, but they are split because the operations and their failure modes differ.
BE-6 covers fetching and storing Product title / Product tags (ADR-0003). Outputting them as CSV columns is part of BE-5, so BE-6 can be closed in Step 3.

## Submission

| ID | Issue | Requirement | Milestone |
|---|---|---|---|
| SUB-1 | #7 | GitHub repository with regular commits | Step 8 |
| SUB-2 | #8 | Database design in the README | Step 2 |
| SUB-3 | #9 | Screenshots | Step 8 |
| SUB-4 | #10 | Sample exported CSV | Step 6 |
| SUB-5 | #11 | Install and configuration instructions | Step 8 |
| SUB-6 | #12 | Notes on implementation choices | Step 8 |

SUB-* deliverables are documents, so they have no tests.

## Decisions

| ID | Issue | Question | Recorded in |
|---|---|---|---|
| DEC-1 | #13 | Framework (how to satisfy "Remix" in the task) | ADR-0001 |
| DEC-2 | #14 | Which Polaris (Web Components / React) | ADR-0002 |
| DEC-3 | #15 | How order data is obtained (webhook payload / refetch via GraphQL) | ADR-0003 |
| DEC-4 | #16 | Where tags are written (Shopify / app only) | ADR-0004 |
| DEC-5 | #17 | Process webhooks synchronously or via a queue | ADR-0005 |
| DEC-6 | #18 | Interpretation of the task (CSV row granularity, product title, product tag freshness, address, CSV format) | README |
| DEC-7 | #22 | Development process (TDD) | ADR-0006 / CONTRIBUTING.md |

## Chores

| Issue | Description | Milestone |
|---|---|---|
| #19 | Environment setup (development store, scopes, protected customer data) | Step 1 |
| #20 | Vitest setup and test naming | Step 1 |
| #21 | Sync existing orders | Step 3 |
| #23 | Database schema and migration | Step 2 |
| #24 | Review test coverage against requirements | Step 7 |

#21 is not in the task description. It is added because orders placed before the app is installed never arrive via webhook.

---

## Test naming

```
BE-{n} {Feature} : {spec}. {test case}
```

```ts
it("BE-3 Add tag : 1. trims surrounding whitespace", ...);
```

- **The feature number equals the n in requirement ID BE-n**, so a test can be found directly from its ID
- The separator ` : ` is fixed. Feature names must not contain `:`
- Test case names describe the resulting state in the present tense ("is saved", "returns 401", "is rejected")
- `describe` is not used; the full name goes in `it()`

| No. | Feature | Spec numbers |
|---|---|---|
| 1 | Webhook ingestion | 1 = create (orders/create) / 2 = update (orders/updated) / 3 = sync of existing orders (#21), which uses the same ingestion path |
| 2 | Order list | 1 = the order list is displayed (columns decided in DEC-6) |
| 3 | Add tag | 1 = a tag can be added to an order |
| 4 | Remove tag | 1 = a tag can be removed from an order |
| 5 | CSV export | 1 = orders can be exported to a CSV file / 2–10 = CSV template columns in order (2 = Order id … 10 = Created at) / 11 = Product title / 12 = Product tags |
| 6 | Fields not in order JSON | 1 = Product title is fetched and stored / 2 = Product tags are fetched and stored |
| 7 | Whole app | Cross-cutting tests only (no direct basis in the task). 1 = app lifecycle and compliance webhooks (e.g. app/uninstalled, customers/redact) / 2 = UI test setup / 3 = database schema (models, relations, delete behaviour) |

Tests without a direct basis in the task (signature verification, idempotency, escaping, etc.) use the nearest spec number.
Example: signature verification → `BE-1 Webhook ingestion : 1. …`.

The concrete test list for each requirement is in its issue. With TDD, work through it in that order (`CONTRIBUTING.md`).
