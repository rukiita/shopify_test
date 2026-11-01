# Security review

How security is reviewed in this repository. It runs alongside the code review in [REVIEW.md](REVIEW.md) and uses the same reviewer rules and one-round limit.

> This is a review guide for contributors. It is not a vulnerability disclosure policy.

A security review has two parts that do not overlap:

1. **`/security-review`** (built into Claude Code) for general vulnerability patterns in the diff
2. **The checklist in §4** for what `/security-review` does not cover: checks that depend on this app's design, and categories the command excludes by design

## 1. When it is required

A security review is required when a PR touches any of the following. The PR states which ones under **Risks**.

| Area | Examples |
|---|---|
| Authentication and sessions | `authenticate.*`, `shopify.server.ts`, session storage |
| Webhooks | Any `webhooks.*` route, `shopify.app.toml` subscriptions |
| Customer data | Reading, storing, logging or exporting names, emails or addresses |
| Shopify writes | `tagsAdd`, `tagsRemove`, any mutation |
| Scopes and configuration | `shopify.app.toml` scopes, environment variables |
| Exports | CSV generation and download |
| Dependencies | Adding or upgrading packages |

In addition, one full pass over the whole app runs before submission (Step 7). `/security-review` only reads the diff, so the full pass uses the §4 checklist over the whole codebase.

## 2. Who runs it

Same as [REVIEW.md](REVIEW.md) §1: never the agent that wrote the code, and merging stays with the author.

For `/security-review`, open a **new Claude Code session** for it. Do not run it in the session that wrote the change.

## 3. Step 1: `/security-review`

Run `/security-review` on the PR branch. It covers, among others:

- Injection (including into queries), XSS, path traversal
- Authentication and authorization bypass, session flaws
- Hardcoded secrets, weak cryptography
- Sensitive data and PII in logs, responses or debug output

These are **not** repeated in §4. Use its report as the findings for this part.

## 4. Step 2: checklist for what `/security-review` does not cover

### Checks that depend on this app's design

`/security-review` looks for auth and authorization flaws in general, but it does not know where this app is supposed to authenticate or where the shop must come from.

| Check | Where to look |
|---|---|
| Every webhook route calls `authenticate.webhook(request)` before the body is used | `app/routes/webhooks.*` |
| Every loader and action under `app/` calls `authenticate.admin(request)`. Side effects happen only in actions, never in loaders (GET) | `app/routes/app.*` |
| The shop comes from the authenticated session or the verified webhook, never from a query parameter, form field or body. Every query filters by that shop | Repositories and every caller |

### Categories `/security-review` excludes by design

The command skips test files, documentation, missing hardening, data retention and outdated dependencies. These still matter here:

| Check | Why it matters here |
|---|---|
| Only the customer fields the app needs are stored. A shop's data is deleted on `app/uninstalled` and `shop/redact`, and `customers/redact` removes the customer fields from the listed orders | Protected customer data terms; less to leak |
| `test/fixtures/` and `samples/` contain only test names, emails and addresses | Fixtures are captured from real responses (CONTRIBUTING.md, "spike"), and test files are outside `/security-review` |
| Scopes stay at `read_customers` (the order's customer name, #1), `read_orders`, `read_products`, `write_orders` (ADR-0004). Any addition is justified in the PR | Least privilege; merchants grant these at install |
| CSV cells starting with `=`, `+`, `-`, `@`, tab or carriage return cannot run as formulas in a spreadsheet | Tags and customer fields are user-controlled and end up in Excel |
| `npm audit --audit-level=high` reports no high or critical issues, or each one is explained in the PR | Dependency vulnerabilities are outside `/security-review` |

## 5. Reporting

- `/security-review` findings are used as reported. Map its severity: **High → Blocker**, **Medium → Major**, **Low → Minor**, and prefix with **Security** (e.g. **Security · Blocker**)
- Checklist findings use the [REVIEW.md](REVIEW.md) §3 format with the same **Security** prefix
- Anything that exposes customer data, lets an unauthenticated request change data, or leaks a secret is a **Blocker**
- The fix-and-verify limit in [REVIEW.md](REVIEW.md) §4 covers both parts together: one round, then stop and report

If a finding cannot be fixed within the task, record it in the README under "Known limitations / Production considerations".

## References

- https://github.com/anthropics/claude-code-security-review (`/security-review` command definition and its exclusions)
- https://shopify.dev/docs/apps/build/webhooks (webhook verification)
- https://shopify.dev/docs/apps/launch/protected-customer-data (protected customer data)
- https://owasp.org/www-community/attacks/CSV_Injection (CSV formula injection)
