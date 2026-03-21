# QA Agent Workflow — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Exhaustive automated QA of BudgetMate (personal mode + shared expense multi-user flows) using parallel Playwright agents, followed by an automatic bug-fix pipeline on an isolated git branch.

---

## 1. Overview

A two-phase automated workflow:

**Phase 1 — QA Run:** A team of 10 Playwright agents exercises every feature of the app, creates data from scratch, and writes a unified bug report to `docs/qa/bug-report-YYYY-MM-DD.md`.

**Phase 2 — Fix Pipeline (automatic):** Immediately after the report is written, the pipeline creates a new git branch, generates an implementation plan from the report, and executes it. Merging back to `main` remains manual.

---

## 2. Environment

- **App:** Local dev server (`npm run dev`, `localhost:5173`)
- **Auth backend:** Supabase (real credentials from `.env.local`)
- **Browser automation:** Playwright MCP tools
- **Starting state:** Fresh — all test data created by agents at runtime

---

## 3. Agent Architecture

### 3.1 Setup Agent (runs first, blocking)

Responsibilities:
1. Start the dev server (or verify it is running)
2. Create **three test accounts** in Supabase:
   - `qa-user-a@budgetmate.local` (household owner)
   - `qa-user-b@budgetmate.local` (household member)
   - `qa-user-c@budgetmate.local` (household member)
3. Create a household linking all three accounts with household mode enabled
4. Seed baseline personal data for User A (used by personal-mode specialists):
   - 4 categories: Food, Transport, Housing, Entertainment
   - 1 monthly budget per category
   - 1 recurring expense (monthly rent)
   - 1 savings goal
   - 1 debt
5. Write credentials and entity IDs to `/tmp/qa-session.json`
6. Write initial signal state to `/tmp/qa-shared-signals.json`

### 3.2 Personal-Mode Specialist Agents (7, run in parallel)

All log in as `qa-user-a`. Each writes its findings to `/tmp/qa-report-<agent>.md`.

#### Expenses Agent
**Primary:** Full expense CRUD — create, read, edit, delete. Filters by category/date/amount. Search. Multi-currency expense entry with live rate. Foreign currency badge display. Edge cases: $0 amount, very large amounts, special characters in description, no category selected, all currencies.
**Overlap:** After creating expenses, verifies they appear on Dashboard summary and in Statistics charts.

#### Budget Agent
**Primary:** Budget CRUD. Set limits per category. Create expenses that approach and exceed budget limits. Verify over-budget alerts/indicators trigger. Edit budget amounts. Delete budgets.
**Overlap:** Creates expenses to trigger limits; verifies budget progress bars shown on Dashboard reflect current spend correctly.

#### Goals Agent
**Primary:** Savings goal CRUD. Add contributions. Edit goal target amount and deadline. Mark goal as complete. Edge cases: contributing more than the goal amount, zero contribution, goal with no deadline.
**Overlap:** Checks goals widget on Dashboard after each state change; verifies completion state persists across page navigation.

#### Debts Agent
**Primary:** Debt CRUD. Record payments. Partial payments. Mark debt as fully paid. Edit debt details. Edge cases: debt with $0 balance, overpayment.
**Overlap:** Checks debt summary card on Dashboard; creates an expense and links it to debt repayment; verifies shared-expense-generated debts (after Shared agents run) appear correctly.

#### Recurring Agent
**Primary:** Recurring expense CRUD. All frequency options (daily, weekly, monthly, yearly). Edit frequency and amount. Pause and resume. Delete. Edge cases: recurring expense with foreign currency, recurring with no end date vs. fixed end date.
**Overlap:** Verifies recurring expenses appear in the Expenses list; checks they are reflected on Dashboard.

#### Statistics Agent
**Primary:** Creates its own set of expenses across categories and date ranges. Tests all chart types (monthly bar chart, category pie chart, category breakdown, category monthly chart). Date range filters. Empty state (clears filters to get empty chart). Different time periods.
**Overlap:** Verifies that expenses created by other agents (visible in the shared account) appear correctly in aggregated statistics.

#### Settings Agent
**Primary:** Language switching (tests at least 2 languages including one RTL). Currency change (base currency). Theme toggle if present. Category manager: add, rename, delete categories. Profile settings.
**Overlap:** After changing currency, navigates to Expenses and Dashboard to verify new currency symbol propagates everywhere. After changing language, checks RTL layout integrity across at least 2 pages.

### 3.3 Shared Expense Team (3 coordinated agents)

Uses all three test accounts. Coordinate via `/tmp/qa-shared-signals.json` — each agent writes named checkpoints and polls for peer checkpoints before proceeding.

#### Shared-A Agent (qa-user-a — household owner)
**Scenarios it initiates:**
1. Create a 3-way equal-split shared expense
2. Create a custom-split shared expense (unequal amounts per person)
3. Create a multi-currency shared expense (foreign currency)
4. Record a partial payment from B to A
5. Record final payment completing settlement
6. Create an expense → observe B approves, C rejects → verify partial-approval behavior

**Overlap:** After settlement, checks Expenses list and Statistics to verify settled shared expenses are counted correctly.

#### Shared-B Agent (qa-user-b — member)
**Scenarios it handles:**
1. Sees pending expense notification → approves 3-way equal split → verifies own debt amount is correct
2. Approves custom-split expense → verifies own debt matches custom amount
3. Approves multi-currency expense → verifies debt shown in own base currency with correct conversion
4. Rejects one expense (coordinated with C rejecting) → verifies behavior
5. After Shared-A records B's payment → verifies debt balance drops correctly
6. After full settlement → verifies debt is cleared/marked paid

**Overlap:** Checks Dashboard debt summary after each state change; cross-checks with Debts page.

#### Shared-C Agent (qa-user-c — member)
**Scenarios it handles:**
1. Approves 3-way equal split → verifies own debt amount
2. Approves custom-split → verifies own (different) debt amount
3. Rejects one expense (coordinated rejection scenario with B)
4. Records own payment to A → verifies own debt cleared
5. Verifies the debt web resolves correctly when B and C both pay A

**Overlap:** Checks Statistics to verify shared expenses appear/excluded correctly per user; verifies Dashboard reflects correct state for User C's perspective.

---

## 4. Coordination Protocol

### Session file: `/tmp/qa-session.json`
```json
{
  "users": {
    "a": { "email": "qa-user-a@budgetmate.local", "password": "..." },
    "b": { "email": "qa-user-b@budgetmate.local", "password": "..." },
    "c": { "email": "qa-user-c@budgetmate.local", "password": "..." }
  },
  "householdId": "...",
  "seedData": { "categories": [...], "budgetIds": [...], ... }
}
```

### Signal file: `/tmp/qa-shared-signals.json`
Named checkpoints written by each shared agent. Peers poll every 5 seconds (max 2 minutes timeout before reporting a coordination bug).

```json
{
  "a_created_equal_split": true,
  "b_approved_equal_split": true,
  "c_approved_equal_split": true,
  "a_created_custom_split": true,
  ...
}
```

### Partial report files: `/tmp/qa-report-<agent>.md`
Each agent writes its own section independently. Named: `expenses`, `budget`, `goals`, `debts`, `recurring`, `statistics`, `settings`, `shared-a`, `shared-b`, `shared-c`.

---

## 5. Bug Report Format

**Output path:** `docs/qa/bug-report-YYYY-MM-DD.md`

**Severity scale:**
| Level | Meaning |
|---|---|
| CRITICAL | App crash, data loss, auth failure, flow completely blocked |
| HIGH | Feature broken, wrong data saved, workaround possible |
| MEDIUM | Missing validation, confusing UX, partial failure |
| LOW | Cosmetic issue, minor inconsistency |

**Report structure:**
```
# BudgetMate QA Bug Report — YYYY-MM-DD

## Summary
- Total bugs: N
- CRITICAL: N | HIGH: N | MEDIUM: N | LOW: N
- Agents run: 10
- Features tested: [list]

## Bugs (sorted by severity)

### BUG-001 · CRITICAL · <Page/Feature>
**Agent:** <agent name>
**Steps to Reproduce:**
1. ...
2. ...
**Expected:** ...
**Actual:** ...
**Notes:** (console errors, network failures, data issues)

---
[repeat for each bug]
```

---

## 6. Fix Pipeline (Automatic, Post-Report)

Triggered automatically after the Merge Agent writes the report. No user action required until the final merge.

```
Bug Report Written
       ↓
git checkout -b qa-fixes-YYYY-MM-DD
       ↓
Parse report → sort bugs by severity (CRITICAL first)
       ↓
Invoke superpowers:writing-plans → docs/superpowers/plans/YYYY-MM-DD-qa-fixes.md
       ↓
Invoke superpowers:executing-plans → implements fixes on branch
       ↓
[ MANUAL ] User reviews branch and merges to main
```

**Pipeline stops and surfaces to user when:**
- A bug requires a design decision beyond a simple fix
- Two fixes conflict with each other
- A bug description is ambiguous

**Branch naming:** `qa-fixes-YYYY-MM-DD`

---

## 7. Implementation Notes

- All agents use Playwright MCP tools (`browser_navigate`, `browser_click`, `browser_fill_form`, `browser_snapshot`, `browser_take_screenshot`, etc.)
- The dev server must be running before the Setup Agent starts
- Each specialist agent handles its own login at start; no shared browser sessions
- Agents run with isolation via git worktrees where possible
- The fix pipeline runs in the main session (not a worktree) since it needs to commit to the new branch
