#!/usr/bin/env bash
# Create repository settings, labels, milestones and issues in one go.
# Run once on a fresh repository.
#
#   ./scripts/bootstrap-issues.sh            # run
#   DRY_RUN=1 ./scripts/bootstrap-issues.sh  # print the commands only
#
# Requires: gh CLI logged in (gh auth status), run from inside the repository.
# Issue numbers in docs/requirements.md assume issues are created in this order starting at #1,
# so the script aborts if the repository already has any issue or PR.

set -euo pipefail

cd "$(dirname "$0")/.."
ISSUES_DIR="scripts/issues"
MANIFEST="$ISSUES_DIR/manifest.tsv"

run() {
  if [[ "${DRY_RUN:-}" == "1" ]]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

# --- Preconditions -----------------------------------------------------------

if [[ "${DRY_RUN:-}" != "1" ]]; then
  gh auth status >/dev/null
  repo="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
  # Issues and PRs share numbers, so count both
  count="$(gh api "repos/$repo/issues?state=all&per_page=1" -q 'length')"
  if [[ "$count" != "0" ]]; then
    echo "Aborted: $repo already has issues or PRs. Issue numbers would no longer match docs/requirements.md." >&2
    exit 1
  fi
  echo "Target: $repo"
else
  repo="OWNER/REPO"
fi

# --- Merge settings ----------------------------------------------------------
# Allow merge commits only, so TDD commits (test → feat → refactor) stay in the history (ADR-0006)

run gh repo edit --enable-merge-commit --enable-squash-merge=false --enable-rebase-merge=false --delete-branch-on-merge

# --- Labels ------------------------------------------------------------------

labels=(
  "requirement|1d76db|Requirement from the task description (BE-n / SUB-n)"
  "decision|5319e7|Design decision (DEC-n), recorded in an ADR or the README"
  "chore|c5def5|Setup and tooling"
  "enhancement|a2eeef|Not in the task description, but needed"
  "docs|0075ca|Deliverable is documentation"
  "area:webhook|fbca04|Webhooks and data ingestion"
  "area:ui|f9d0c4|User interface"
  "area:tags|d4c5f9|Tag editing"
  "area:csv|bfd4f2|CSV export"
)
for entry in "${labels[@]}"; do
  IFS='|' read -r name color desc <<<"$entry"
  run gh label create "$name" --color "$color" --description "$desc" --force
done

# --- Milestones --------------------------------------------------------------
# Due at the end of the day in Japan time (23:59 JST = 14:59 UTC). Edit here if the schedule changes.

milestones=(
  "Step 0: Requirements and decisions|2026-10-31"
  "Step 1: Environment setup|2026-10-31"
  "Step 2: Database design|2026-11-01"
  "Step 3: Webhook ingestion|2026-11-02"
  "Step 4: Order list|2026-11-02"
  "Step 5: Tag editing|2026-11-03"
  "Step 6: CSV export|2026-11-04"
  "Step 7: Test review|2026-11-04"
  "Step 8: README and submission|2026-11-04"
)
for entry in "${milestones[@]}"; do
  IFS='|' read -r title due <<<"$entry"
  run gh api "repos/$repo/milestones" -f title="$title" -f due_on="${due}T14:59:59Z" --silent
done

# --- Issues ------------------------------------------------------------------

n=0
while IFS=$'\t' read -r file title labels milestone; do
  [[ -z "$file" || "$file" == \#* ]] && continue
  n=$((n + 1))
  body="$ISSUES_DIR/$file"
  [[ -f "$body" ]] || { echo "Missing body: $body" >&2; exit 1; }
  run gh issue create --title "$title" --body-file "$body" --label "$labels" --milestone "$milestone"
  echo "  -> #$n $title"
done <"$MANIFEST"

echo "Done: $n issues"
