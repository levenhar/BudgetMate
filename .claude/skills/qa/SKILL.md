---
name: qa
description: Run BudgetMate QA — lead agent reads git history + last bug report to prioritize, dispatches parallel Playwright test agents per spec, collects structured results, decides targeted re-runs, creates a merged bug report via merge-reports.js, then implements fixes on a new branch and opens a PR.
user-invocable: true
---

# /qa — BudgetMate QA Pipeline

You are the **lead QA agent**. Orchestrate 10 parallel test agents, collect results, decide re-runs, produce the merged bug report, then implement fixes and open a PR.

## Prerequisites

Verify the dev server is running before doing anything else:
```bash
curl -s http://localhost:5173 > /dev/null && echo "server OK" || echo "NOT RUNNING"
```
If not running: tell the user to start it with `npm run dev` and stop.

---

## Phase 1: Context Analysis — Build Priority Matrix

```bash
git log --oneline -10
git diff --name-only HEAD~5 HEAD
ls docs/qa/bug-report-*.md 2>/dev/null | sort | tail -1
```

Read the latest bug report. Build this table (fill in real values):

| Area | Source file(s) recently changed? | Severity in last report | → Priority |
|------|----------------------------------|------------------------|------------|
| expenses | yes/no | CRITICAL/HIGH/MEDIUM/LOW/none | CRITICAL/HIGH/MEDIUM/LOW |
| budget | yes/no | … | … |
| goals | yes/no | … | … |
| debts | yes/no | … | … |
| recurring | yes/no | … | … |
| statistics | yes/no | … | … |
| shared | yes/no | … | … |
| settings | yes/no | … | … |

Priority rules:
- **CRITICAL** — area had a CRITICAL bug in last report
- **HIGH** — source files changed in last 5 commits, OR area had HIGH bugs in last report (and no CRITICAL)
- **MEDIUM** — area had MEDIUM bugs in last report (and no higher severity)
- **LOW** — no recent changes, no prior bugs

---

## Phase 2: Round 1 — Dispatch 6 Parallel Agents

In a **single message**, dispatch all 6 agents simultaneously (one Agent tool call per agent).

Use this prompt template for each (substitute `SPEC` and `PRIORITY`):

```
You are a QA test runner for BudgetMate (React + Supabase budget app).

From the repo root, run:
  npx playwright test qa/specs/SPEC.spec.js --config qa/playwright.config.js --reporter json 2>&1

Then read the tmp bug file (ignore if missing):
  node -e "const os=require('os'),fs=require('fs'),p=require('path').join(os.tmpdir(),'qa-report-SPEC.md'); console.log(fs.existsSync(p)?fs.readFileSync(p,'utf8'):'(no bugs reported)');"

Return EXACTLY this block (real values only — no placeholders):

## AGENT: SPEC
STATUS: completed | failed | timeout
TESTS: X passed, Y failed, Z timed-out
PRIORITY: PRIORITY
BUGS:
[paste tmp bug file contents verbatim, or "none"]
NOTES: [any observations about flakiness, environment issues, surprising behavior]
```

> **Note:** `shared-expense-chips.spec.js` is intentionally excluded from the automated pipeline and must be run manually if needed.

Agents to dispatch simultaneously in Round 1:
- spec=`expenses`,   priority from your matrix
- spec=`budget`,     priority from your matrix
- spec=`goals`,      priority from your matrix
- spec=`debts`,      priority from your matrix
- spec=`recurring`,  priority from your matrix
- spec=`statistics`, priority from your matrix

**Wait for all 6 to return before continuing.**

---

## Phase 3: Round 2 — Settings + Shared

### Round 2a — Settings (1 agent, after Round 1)

Settings has a Playwright project dependency on all 6 Round-1 specs. Dispatch 1 agent:

```
You are a QA test runner for BudgetMate.

Run: npx playwright test qa/specs/settings.spec.js --config qa/playwright.config.js --reporter json 2>&1

Read the tmp bug file:
  node -e "const os=require('os'),fs=require('fs'),p=require('path').join(os.tmpdir(),'qa-report-settings.md'); console.log(fs.existsSync(p)?fs.readFileSync(p,'utf8'):'(no bugs reported)');"

Return the standard AGENT block with AGENT: settings.
```

### Round 2b — Shared Expenses (3 agents, MUST be simultaneous)

⚠️ **CRITICAL:** shared-a, shared-b, and shared-c coordinate via signal files in `os.tmpdir()`. They poll each other with a 2-minute timeout. If they don't start at the same time, earlier ones will timeout waiting.

**Dispatch all 3 in a single message:**

Agent shared-a:
```
You are QA agent shared-a for BudgetMate. The other two shared agents (shared-b, shared-c) are running simultaneously — they coordinate with you via signal files in the system tmp directory.

Run: npx playwright test qa/specs/shared-a.spec.js --config qa/playwright.config.js --reporter json 2>&1

Read tmp bug file:
  node -e "const os=require('os'),fs=require('fs'),p=require('path').join(os.tmpdir(),'qa-report-shared-a.md'); console.log(fs.existsSync(p)?fs.readFileSync(p,'utf8'):'(no bugs reported)');"

Return standard AGENT block with AGENT: shared-a.
```

Agent shared-b:
```
You are QA agent shared-b for BudgetMate. The other two shared agents (shared-a, shared-c) are running simultaneously.

Run: npx playwright test qa/specs/shared-b.spec.js --config qa/playwright.config.js --reporter json 2>&1

Read tmp bug file:
  node -e "const os=require('os'),fs=require('fs'),p=require('path').join(os.tmpdir(),'qa-report-shared-b.md'); console.log(fs.existsSync(p)?fs.readFileSync(p,'utf8'):'(no bugs reported)');"

Return standard AGENT block with AGENT: shared-b.
```

Agent shared-c:
```
You are QA agent shared-c for BudgetMate. The other two shared agents (shared-a, shared-b) are running simultaneously.

Run: npx playwright test qa/specs/shared-c.spec.js --config qa/playwright.config.js --reporter json 2>&1

Read tmp bug file:
  node -e "const os=require('os'),fs=require('fs'),p=require('path').join(os.tmpdir(),'qa-report-shared-c.md'); console.log(fs.existsSync(p)?fs.readFileSync(p,'utf8'):'(no bugs reported)');"

Return standard AGENT block with AGENT: shared-c.
```

**Wait for all 3 to return before continuing.**

---

## Phase 4: Evaluate Results — Optional Round 3

Review all 10 agent return blocks. Trigger a re-run (max 1 extra round) if:

| Condition | Action |
|-----------|--------|
| Any `shared-*` agent STATUS=timeout | Re-run ALL THREE shared agents simultaneously (never individually) — clear stale signals first |
| CRITICAL or HIGH priority area had ≥50% tests failed | Re-run that one agent |
| Any non-shared agent STATUS=timeout | Re-run that one agent |

**Before re-running shared agents, clear stale signal files:**
```bash
node -e "
const os = require('os'), fs = require('fs'), path = require('path');
const dir = os.tmpdir();
fs.readdirSync(dir)
  .filter(f => f.startsWith('qa-signal-'))
  .forEach(f => { fs.unlinkSync(path.join(dir, f)); console.log('deleted', f); });
console.log('signals cleared');
"
```

**Maximum 1 extra round.** Accept final results regardless and proceed.

---

## Phase 5: Merge Bug Reports

```bash
node qa/merge-reports.js
```

Expected output: `Bug report written to docs/qa/bug-report-YYYY-MM-DD.md (N bugs)`

Print the full summary line (CRITICAL/HIGH/MEDIUM/LOW counts).

Commit:
```bash
git add docs/qa/
git diff --cached --quiet || git commit -m "chore: QA bug report $(date +%Y-%m-%d)"
```

---

## Phase 6: Fix Phase

### 6a — Create fix branch
```bash
BRANCH="qa-fixes-$(date +%Y-%m-%dT%H-%M)"
git checkout -b "$BRANCH"
echo "Branch: $BRANCH"
```

### 6b — Classify bugs

Read `docs/qa/bug-report-$(date +%Y-%m-%d).md`. Process in order: CRITICAL → HIGH → MEDIUM → LOW.

**Fix:**
- CSS/styling issues
- Missing form validation
- Logic or calculation errors
- Missing UI elements the specs expect
- Broken selectors pointing to renamed elements

**Mark BLOCKED and skip:**
- Requires new Supabase columns, tables, or migrations
- Ambiguous expected behavior
- Would require editing `qa/`, `supabase/migrations/`, or `.github/`

For BLOCKED bugs, add in the nearest relevant `src/` file:
```js
// TODO QA-FIX-BLOCKED: BUG-XXX — <reason>
```

### 6c — Implement fixes

For each fixable bug:
1. Read the relevant file(s) in `src/`
2. Implement the minimal fix — no refactoring, no unrelated edits
3. Only write to: `src/`, `public/`, `vite.config.*`, `tailwind.config.*`

**NEVER touch:** `qa/`, `supabase/migrations/`, `.github/`

### 6d — Build verification
```bash
npm run build
```

If build fails:
1. Read the full error, fix it (attempt 1)
2. Run `npm run build` again
3. If still failing (attempt 2): fix again
4. If still failing after attempt 2: revert the responsible fix:
   ```bash
   git checkout -- path/to/broken/file.tsx
   ```
   Add BLOCKED comment, run `npm run build` to confirm it passes.

### 6e — Commit and push
```bash
git add -A
git diff --cached --quiet || git commit -m "fix: implement QA-detected fixes $(date +%Y-%m-%d)"

COMMITS=$(git log origin/main..HEAD --oneline | wc -l)
if [ "$COMMITS" -gt 0 ]; then
  git push origin "$BRANCH"
else
  echo "No commits to push — no fixable bugs found."
fi
```

### 6f — Open PR (only if branch was pushed)
```bash
TODAY=$(date +%Y-%m-%d)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
gh pr create \
  --title "fix: QA-detected bugs $TODAY" \
  --body "$(cat <<PRBODY
## Automated QA Fix PR

Generated by the \`/qa\` skill.

**Bug report:** \`docs/qa/bug-report-$TODAY.md\`

**Review checklist:**
- [ ] Review each fix against the original bug report
- [ ] Run \`npm run dev\` and manually verify the fixed behaviors
- [ ] Run \`npm run build\` to confirm no errors
- [ ] Merge when satisfied

Bugs marked \`TODO QA-FIX-BLOCKED\` in source files require manual attention.
PRBODY
)" \
  --base main \
  --head "$BRANCH"
```
