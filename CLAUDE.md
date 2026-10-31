# CLAUDE.md

Instructions for Claude sessions working in this repository.

## Language

- **Talk to the author in Japanese.**
- **Write everything that is committed or posted to GitHub in English**: code, comments, tests, commit messages, issues, PRs, ADRs, README, UI text. The reviewers are English speakers.

## Rules to follow

- Process: [CONTRIBUTING.md](CONTRIBUTING.md) — issue-first, TDD (Red → Green → Refactor), commit types, merge commits only, diagrams for complex PRs (§5)
- Requirements and test naming: [docs/requirements.md](docs/requirements.md) — `BE-{n} {Feature} : {spec}. {test case}`
- Design decisions: [docs/adr/](docs/adr/README.md). Do not contradict an Accepted ADR; propose a new ADR instead
- Code review: [REVIEW.md](REVIEW.md). Never review code you wrote; use a separate agent or a fresh subagent. One fix-and-verify round, then stop and report
- Security review: [SECURITY_REVIEW.md](SECURITY_REVIEW.md), required when a PR touches the areas in its §1. Same reviewer rules and round limit

## Decisions belong to the author

- Do not change an ADR's status to `Accepted`, and do not merge a PR, unless the author explicitly asks
- When drafting a decision, list what the author needs to verify and what is a judgment call

## Working notes

- Every PR maps to an issue (`Closes #n`). Create the issue first if there is none
- Do not invent the shape of Shopify API responses. Capture real responses as fixtures first (CONTRIBUTING.md, "spike")
