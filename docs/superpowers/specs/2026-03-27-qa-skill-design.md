# BudgetMate `/qa` Skill — Design Spec
**Date:** 2026-03-27
**Status:** Approved

---

## Overview

Replace the GitHub Actions `weekly-qa.yml` cron trigger with a locally-invocable `/qa` Claude Code skill. The skill runs parallel test agents across all 10 QA spec files, produces a combined bug report, and then implements fixes on a new branch and opens a PR — all in one session.

The GitHub Actions workflow file is kept but its `schedule:` cron trigger is removed; `workflow_dispatch:` manual runs remain as a backup.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  LEAD AGENT                      │
│  - reads git log + last bug report               │
│  - builds priority matrix per feature area       │
│  - dispatches test agents                        │
│  - reviews results, re-runs if needed            │
│  - creates final merged bug report               │
│  - creates branch → implements fixes → PR        │
└─────────────────────────────────────────────────┘
         │ dispatches
         ▼
┌─────────────────────────────────────────────────┐
│          ROUND 1 — 6 parallel agents             │
│  expenses · budget · goals · debts               │
│  recurring · statistics                          │
│  Each runs its spec via Playwright               │
│  Returns structured result block to lead         │
└─────────────────────────────────────────────────┘
         │ after Round 1 completes
         ▼
┌─────────────────────────────────────────────────┐
│  ROUND 2a — settings (1 agent, sequential)       │
│  ROUND 2b — shared-a + shared-b + shared-c       │
│             (3 agents, launched simultaneously)  │
│             (coordinate via signal files)        │
└─────────────────────────────────────────────────┘
         │ lead reviews all results
         ▼
┌─────────────────────────────────────────────────┐
│  OPTIONAL ROUND 3 — targeted re-runs             │
│  Triggered by: shared timeout, high-priority     │
│  area ≥50% failure, or inconclusive results      │
│  Maximum 1 extra round                           │
└─────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  FIX PHASE                                       │
│  branch qa-fixes-{date}T{hh-mm}                  │
│  → fix bugs CRITICAL→HIGH→MEDIUM→LOW             │
│  → npm run build (fix errors if any)             │
│  → commit → push → PR                           │
└─────────────────────────────────────────────────┘
```

---

## Lead Agent: Decision Logic

### Inputs
1. `git log --oneline -10` + `git diff --name-only HEAD~5 HEAD` — recently changed source files
2. Latest `docs/qa/bug-report-*.md` — which areas had HIGH/CRITICAL bugs last run
3. `qa/TEST_ORDER.md` — what each spec covers

### Priority Matrix
The lead builds a priority table before dispatching:

| Priority | Assignment Rule |
|----------|----------------|
| CRITICAL | Spec area had CRITICAL bug in last report |
| HIGH | Source files for this area changed in last 5 commits |
| MEDIUM | Spec area had HIGH bugs in last report |
| LOW | No recent changes, no previous bugs |

Priority affects:
- Whether the area is a candidate for a Round 3 re-run
- The weight given to its bugs in the final sorted report
- What the fix agent tackles first

### Re-run Trigger Rules (Round 3)
- Any `shared-*` agent timed out waiting for a signal → re-run all 3 shared agents together (never individually — they must run simultaneously)
- A CRITICAL/HIGH-priority spec had ≥50% test failure rate → re-run once
- Maximum **1 extra round** regardless of results

---

## Test Agent Protocol

### What each agent receives
- Spec file path (`qa/specs/expenses.spec.js`)
- Playwright config path (`qa/playwright.config.js`)
- Its assigned priority level
- For shared agents: explicit instruction that all 3 must be active simultaneously

### What each agent does
1. Runs: `npx playwright test qa/specs/[spec].spec.js --config qa/playwright.config.js --reporter json 2>&1`
2. Parses JSON output: pass count, fail count, timeouts
3. Reads tmp bug file produced by the spec: `/tmp/qa-report-[agent].md`
4. Returns a structured result block

### Return Format
```
## AGENT: [name]
STATUS: completed | failed | timeout
TESTS: X passed, Y failed
PRIORITY: CRITICAL | HIGH | MEDIUM | LOW
BUGS:
### BUG · [SEVERITY] · [Feature / Sub-feature]
**Agent:** [name]
**Route:** http://localhost:5173/[path]
**Steps to Reproduce:**
1. ...
**Expected:** ...
**Actual:** ...
**Console Errors:** ...
**Notes:** ...
---
NOTES: [any observations about flakiness, timeouts, etc.]
```

### Special Case: Shared Agents
- `shared-a`, `shared-b`, `shared-c` are always dispatched as a single parallel batch
- They coordinate via signal files in `os.tmpdir()`
- The lead collects all 3 return blocks before merging their bugs

---

## Final Report Creation

1. Lead collects all agent return blocks and reviews results/re-run decisions
2. Runs `node qa/merge-reports.js` — this reads the tmp files each spec wrote via `reportBug()`, sorts by severity, re-numbers, and writes `docs/qa/bug-report-{date}.md`
3. Commits: `chore: QA bug report {date}`

> The lead agent does NOT re-implement the merge logic — it delegates to the existing script.

Report header format (matches existing):
```markdown
# BudgetMate QA Bug Report — YYYY-MM-DD
## Summary
- Total bugs: N
- CRITICAL: X | HIGH: Y | MEDIUM: Z | LOW: W
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts,
  Recurring Expenses, Statistics, Settings, Shared Expenses (3-user household)
## Bugs (sorted by severity)
...
```

---

## Fix Phase

### Branch
`qa-fixes-{YYYY-MM-DD}T{HH-MM}`

### Fix Process
1. Read the committed bug report
2. Filter bugs by fixability:
   - **Fix:** CSS/styling issues, missing validation, logic errors, broken selectors, calculation bugs
   - **Skip (mark BLOCKED):** New DB columns needed, migration changes, ambiguous expected behavior → add `// TODO QA-FIX-BLOCKED: <reason>` in nearest relevant source file
3. Implement fixes in order: CRITICAL → HIGH → MEDIUM → LOW
4. After all fixes: run `npm run build`
   - If build fails: read the error, fix it, retry (max 2 attempts)
   - If still failing after 2 attempts: mark the responsible fix BLOCKED, revert it, rebuild
5. Commit: `fix: implement QA-detected fixes {date}`
6. Push branch, open PR

### Scope Guards (never touch)
- `qa/` — all QA infrastructure is off-limits
- `supabase/migrations/`
- `.github/`

Only edit files under: `src/`, `public/`, root config files (`vite.config.*`, `tailwind.config.*`, etc.)

### PR Body Template
```markdown
## Automated QA Fix PR

**Bug report:** `docs/qa/bug-report-{date}.md`

**Review checklist:**
- [ ] Review each fix against the original bug report
- [ ] Run `npm run dev` and manually verify fixed behaviors
- [ ] Run `npm run build` to confirm no errors
- [ ] Merge when satisfied

Bugs marked `TODO QA-FIX-BLOCKED` require manual attention.
```

---

## GitHub Actions Change

In `.github/workflows/weekly-qa.yml`:
- **Remove** the `schedule:` block (cron trigger)
- **Keep** `workflow_dispatch:` for manual backup runs
- No other changes to the workflow file

---

## Skill File

**Location:** `.claude/skills/qa/SKILL.md`
**Invocation:** `/qa`
**Arguments:** none (lead agent decides what to run based on context)

---

## Files Created / Modified

| File | Action |
|------|--------|
| `.claude/skills/qa/SKILL.md` | Create — the skill |
| `.github/workflows/weekly-qa.yml` | Modify — remove `schedule:` block |
