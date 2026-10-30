# Contributing

This repository is developed issue-first with TDD. The reasoning is in [ADR-0006](docs/adr/0006-tdd.md).

## 1. Branch from an issue

```bash
git switch -c issue-3-add-tag
```

Branch names follow `issue-{number}-{short-description}`. One branch handles one issue.

## 2. Check the test list

The issue's "Test list" defines the order of work. If something is missing, add it to the issue first.
Test names follow "Test naming" in [docs/requirements.md](docs/requirements.md).

## 3. Red → Green → Refactor

Repeat for each line of the test list.

| Stage | What to do | Commit |
|---|---|---|
| Red | Write one failing test and **confirm it fails for the expected reason** | `test: trim surrounding whitespace from tags (#3)` |
| Green | Write the minimum code to make it pass | `feat: trim surrounding whitespace from tags (#3)` |
| Refactor | Clean up while the tests stay green. Skip if nothing to do | `refactor: simplify normalizeTag branches (#3)` |

- Commit types: `test` / `feat` / `fix` / `refactor` / `docs` / `chore`
- End each message with the issue number
- Red commits only live on the working branch. Only green code reaches `main`

### How each layer is tested

| Target | How |
|---|---|
| `app/lib/domain/` (pure functions) | Inputs and outputs only. No mocks |
| `app/lib/repositories/` (database) | Real reads and writes against a test SQLite database. Prisma is not mocked |
| Routes (webhooks, loaders, actions) | Mock only `authenticate.*` and `admin.graphql`; use the real database |
| UI | Follows the outcome of ADR-0002 |
| Configuration (`shopify.app.toml`, scopes) | Not tested. Verified by hand and documented in the README |

### When the shape of external data is unknown (spike)

Do not write tests against data whose shape you have not seen, such as GraphQL responses.

1. Call the API with throwaway code to see the real shape (do not commit this code)
2. Save the response under `test/fixtures/` (replace names and addresses with test values)
3. Start TDD with the fixture as input

## 4. Open a pull request

- Fill in every item of the PR template
- Put `Closes #n` in the description
- Merge with **Create a merge commit**. Squash and rebase merges are disabled because they would erase the TDD commits
