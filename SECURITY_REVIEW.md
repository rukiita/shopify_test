# Security review

How security is reviewed in this repository. It runs alongside the code review in [REVIEW.md](REVIEW.md) and uses the same reviewer rules, finding format and one-round limit.

> This is a review guide for contributors. It is not a vulnerability disclosure policy.

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

In addition, one full pass over the whole app runs before submission (Step 7).

## 2. Who reviews

Same as [REVIEW.md](REVIEW.md) §1: never the agent that wrote the code, given only the diff, the issue and the documents, and merging stays with the author.

## 3. Checklist

| Area | Check | Why it matters here |
|---|---|---|
| Webhook authenticity | Every webhook route calls `authenticate.webhook(request)` before reading the body. No code path processes an unverified request | Anyone can POST to a public webhook URL; an unverified request could write fake orders |
| Admin authentication | Every loader and action under `app/` calls `authenticate.admin(request)`. Side effects happen only in actions, never in loaders (GET) | A GET with side effects can be triggered by a link |
| Shop isolation | The shop comes from the authenticated session or the verified webhook, never from a query parameter, form field or request body. Every query filters by that shop | Trusting a client-supplied shop would expose other merchants' orders |
| Customer data in logs and errors | Logs, error messages and responses contain no names, emails, addresses, request bodies or access tokens. Error responses do not include stack traces | Protected customer data must not leak through logs or error pages |
| Customer data at rest | Only the fields the app needs are stored. A shop's data is deleted on `app/uninstalled` | Minimises what can leak; required by the protected customer data terms |
| Fixtures and samples | Files in `test/fixtures/` and `samples/` contain only test names, emails and addresses | Fixtures are captured from real responses (CONTRIBUTING.md, "spike") |
| Secrets | No API secret, access token or `.env` file is committed. `.env` is in `.gitignore` | A leaked secret lets anyone forge webhooks or call the Admin API |
| Scopes | Scopes stay at `read_orders`, `read_products`, `write_orders` (ADR-0004). Any addition is justified in the PR | Least privilege; merchants grant these at install |
| GraphQL input | User input reaches GraphQL only through variables, never through string concatenation | Prevents query injection |
| Tag input | Tags go through `normalizeTag` (trim, length, empty, duplicate) before any API call | Unvalidated input reaches the merchant's Shopify data |
| CSV formula injection | Cells starting with `=`, `+`, `-`, `@`, tab or carriage return cannot run as formulas when opened in a spreadsheet | Tags and customer fields are user-controlled and end up in Excel |
| Dependencies | `npm audit --audit-level=high` reports no high or critical issues, or each one is explained in the PR | Known vulnerabilities in dependencies |

## 4. Tools

Run these in every security review. They are minimum checks; a clean result does not replace reading the diff.

```bash
# Dependencies with known high or critical vulnerabilities
npm audit --audit-level=high

# Committed secrets (Shopify access tokens, app secrets). This file is excluded because it contains the pattern
git grep -nE "(shpat_|shpss_|SHOPIFY_API_SECRET=.+)" -- . ':!SECURITY_REVIEW.md'

# Logging that may contain customer data or request bodies
git grep -nE "console\.(log|error|warn)\(.*(email|address|name|request\.body|payload)" -- app
```

`git grep` exits with status 1 when nothing is found, which is the expected result.

## 5. Reporting

Use [REVIEW.md](REVIEW.md) §3 for each finding, with **Security** in front of the severity (e.g. **Security · Blocker**).

- Anything that exposes customer data, lets an unauthenticated request change data, or leaks a secret is a **Blocker**
- The fix-and-verify limit in [REVIEW.md](REVIEW.md) §4 applies: one round, then stop and report

If a finding cannot be fixed within the task (for example, the mandatory compliance webhooks for App Store distribution), record it in the README under "Known limitations / Production considerations".

## References

- https://shopify.dev/docs/apps/build/webhooks (webhook verification)
- https://shopify.dev/docs/apps/launch/protected-customer-data (protected customer data)
- https://owasp.org/www-community/attacks/CSV_Injection (CSV formula injection)
