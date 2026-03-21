# QA Agent Workflow — Design Spec

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Exhaustive automated QA of BudgetMate (personal mode + shared expense multi-user flows) using parallel Playwright agents, followed by an automatic bug-fix pipeline on an isolated git branch.

---

## 1. Overview

A two-phase automated workflow:

**Phase 1 — QA Run:** A team of 10 Playwright agents exercises every feature of the app, creates data from scratch, and writes a unified bug report to `docs/qa/bug-report-YYYY-MM-DD.md`.

**Phase 2 — Fix Pipeline (automatic):** Immediately after the report is written, the pipeline creates a new git branch, generates an implementation plan from the report, and executes it. The dev server is stopped before Phase 2 begins. Merging back to `main` remains manual.

---

## 2. Environment & Prerequisites

- **App:** Local dev server (`npm run dev`, `localhost:5173`) — running during Phase 1 only; stopped before Phase 2
- **Auth backend:** Supabase (credentials from `.env.local`)
- **Browser automation:** Playwright MCP tools
- **Starting state:** Fresh — all test data created by agents at runtime

**Required before running:**
1. Dev server running (`npm run dev`)
2. `SUPABASE_SERVICE_ROLE_KEY` present in `.env.local`

**Setup Agent pre-flight check:** Before creating accounts, verify `SUPABASE_SERVICE_ROLE_KEY` is set and non-empty. If missing, halt with: "SETUP ERROR: Add SUPABASE_SERVICE_ROLE_KEY to .env.local. This key is required to create test accounts without email confirmation."

---

## 3. Confirmed Schema

From `supabase/migrations/001_init.sql` and `003_savings_goals.sql`:

**Household membership model:** No join table. The `households` table has `owner_email text` and `member_emails text[]`. Membership is set by updating `households.member_emails` to include B and C emails. User settings use `user_settings.current_household_id text` and `user_settings.mode text` (values: `'personal'`, `'household'`).

**Seeded record tagging — field mapping per entity:**
| Entity | Table | Tag field | Tagged value example |
|---|---|---|---|
| Category | `categories` | `name` | `"Food [seeded]"` |
| Budget | `budgets` | none available — identify by ID only (from session.json) | N/A |
| RecurringExpense | `recurring_expenses` | `name` | `"Rent [seeded]"` |
| SavingsGoal | `savings_goals` | `name` | `"Emergency Fund [seeded]"` |
| Debt | `debts` | none available — identify by ID only (from session.json) | N/A |

For budgets and debts that cannot be tagged by name, agents must identify seeded records solely by checking against the IDs in `seedData.budgetIds` and `seedData.debtId` from `/tmp/qa-session.json`. Never delete a budget or debt whose ID matches a seedData ID.

**Shared expense approval model:** Approvals are tracked via `notifications.action_taken` (`'none'`, `'approved'`, `'rejected'`). The `shared_expenses` table uses `is_pending boolean` and `pending_with_users text[]` to track who has not yet acted. When a user approves, they are removed from `pending_with_users`. There is no explicit "Partially Approved" status field. The expected partial-approval UI behavior is: the expense shows in A's shared expense list as still pending (because C has not approved), B's debt exists, C has no debt.

---

## 4. Agent Architecture

### 4.1 Setup Agent (runs first, blocking)

Responsibilities:
1. Verify the dev server is responding at `localhost:5173`
2. Check `SUPABASE_SERVICE_ROLE_KEY` is present (see pre-flight above)
3. **Idempotency:** Delete test accounts if they already exist from a prior run before re-creating:
   - Delete `qa-user-a@budgetmate.local`, `qa-user-b@budgetmate.local`, `qa-user-c@budgetmate.local` via Supabase Admin API if they exist
   - Delete any `households` record with `name = "QA Household"` from a prior run
4. Create **three test accounts** using Supabase Admin API with `email_confirm: true`:
   - `qa-user-a@budgetmate.local` / password: `QAtest!2026` (household owner)
   - `qa-user-b@budgetmate.local` / password: `QAtest!2026` (household member)
   - `qa-user-c@budgetmate.local` / password: `QAtest!2026` (household member)
5. Create `user_settings` record for each user with `mode = 'personal'` and `currency = 'USD'`
6. Create a household and membership:
   ```
   INSERT INTO households (name, owner_email, member_emails, invite_code)
   VALUES ('QA Household', 'qa-user-a@budgetmate.local',
           ARRAY['qa-user-b@budgetmate.local', 'qa-user-c@budgetmate.local'],
           'QA-TEST-CODE')
   ```
   Then update each user's settings: `UPDATE user_settings SET current_household_id = <householdId>, mode = 'household' WHERE user_email = <email>`
7. Seed **read-only baseline data** for User A (create via Supabase Admin API authenticated as User A, or directly via SQL):
   - 4 categories with `name` tagged `[seeded]`: `"Food [seeded]"`, `"Transport [seeded]"`, `"Housing [seeded]"`, `"Entertainment [seeded]"`, `user_email = 'qa-user-a@budgetmate.local'`
   - 1 budget per seeded category: `budget_type = 'per_category'`, `amount = 500`, `user_email = 'qa-user-a@budgetmate.local'` — identified by ID only
   - 1 recurring expense: `name = "Rent [seeded]"`, `amount = 1200`, `frequency = 'monthly'`, `start_date = '2026-01-01'`, `category_id = <Housing [seeded] category ID>`, `category_name = "Housing [seeded]"`, `user_email = 'qa-user-a@budgetmate.local'`
   - 1 savings goal: `name = "Emergency Fund [seeded]"`, `target_amount = 10000`, `current_amount = 0`, `user_email = 'qa-user-a@budgetmate.local'`
   - 1 debt: `from_user_id = 'qa-user-a@budgetmate.local'`, `to_user_id = 'external-creditor'`, `amount = 500` — identified by ID only
8. Write `/tmp/qa-session.json`:
   ```json
   {
     "users": {
       "a": { "email": "qa-user-a@budgetmate.local", "password": "QAtest!2026", "id": "..." },
       "b": { "email": "qa-user-b@budgetmate.local", "password": "QAtest!2026", "id": "..." },
       "c": { "email": "qa-user-c@budgetmate.local", "password": "QAtest!2026", "id": "..." }
     },
     "householdId": "...",
     "seedData": {
       "categoryIds": { "food": "...", "transport": "...", "housing": "...", "entertainment": "..." },
       "budgetIds": { "food": "...", "transport": "...", "housing": "...", "entertainment": "..." },
       "recurringExpenseId": "...",
       "savingsGoalId": "...",
       "debtId": "..."
     }
   }
   ```
9. Write `/tmp/qa-signal-setup.json`:
   ```json
   { "setup_complete": true }
   ```

### 4.2 Personal-Mode Specialist Agents (7, run in parallel after Setup Agent)

**Wait-for-setup:** Before doing anything, each specialist must poll `/tmp/qa-signal-setup.json` for `setup_complete: true`. Poll every 5 seconds, timeout after 3 minutes. On timeout: halt with "SETUP TIMEOUT: Setup Agent did not complete. Aborting."

All log in as `qa-user-a`. Each creates its **own test data** — never modifies or deletes records whose IDs match those in `seedData`. Never issues delete-all operations; always delete by specific agent-created IDs. Each writes findings to `/tmp/qa-report-<agent>.md`.

#### Expenses Agent
**Primary:** Full expense CRUD — create, read, edit, delete. Filters by category/date/amount. Search. Multi-currency expense entry with live rate. Foreign currency badge display.
Edge cases: $0 amount, very large amounts (999999), special characters in description, no category selected, every available currency.
**Overlap:** After creating expenses, navigates to Dashboard and verifies expense total is non-zero. Navigates to Statistics and verifies at least one chart renders with data.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-expenses.json` when done.

#### Budget Agent
**Primary:** Budget CRUD — creates its own new budgets (checks IDs do not match `seedData.budgetIds`). Set limits per category. Create expenses that approach and exceed limits. Verify over-budget alerts trigger. Edit budget amounts. Delete only its own budgets.
**Overlap:** Verifies budget progress bars on Dashboard reflect current spend. Checks over-limit state on Dashboard/Budget page.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-budget.json` when done.

#### Goals Agent
**Primary:** Savings goal CRUD — creates its own goals (not `seedData.savingsGoalId`). Add contributions. Edit goal target and deadline. Mark goal complete.
Edge cases: contributing more than goal amount, zero contribution, goal with no deadline.
**Overlap:** Checks goals widget on Dashboard after each state change. Verifies completion state persists after navigating away and back.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-goals.json` when done.

#### Debts Agent
**Primary:** Debt CRUD — creates its own debts (not `seedData.debtId`). Record payments. Partial payments. Mark debt fully paid. Edit debt details.
Edge cases: debt with $0 balance after payment, attempt to overpay.
**Overlap:** Checks debt summary on Dashboard after each state change.
**Note:** Do NOT attempt to link expenses to debt repayment — this linkage feature does not exist in the current codebase.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-debts.json` when done.

#### Recurring Agent
**Primary:** Recurring expense CRUD. All frequency options (daily, weekly, monthly, yearly). Edit frequency and amount. Pause (`is_active = false`) and resume. Delete only its own records.
Edge cases: recurring with foreign currency, recurring with no end date vs. fixed end date.
**Overlap note:** Recurring expenses are templates (shown on the Recurring Expenses page). They are NOT materialized as individual records in the main Expenses list. Do NOT assert they appear in the Expenses list. If the app does materialize them there, note it as a positive finding.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-recurring.json` when done.

#### Statistics Agent
**Primary:** Creates its own expenses with these exact parameters to ensure testable assertions:
- All expense dates within the current calendar month (March 2026)
- At least 2 expenses per seeded category (Food, Transport, Housing, Entertainment)
- After creating, tests all chart types: monthly bar chart, category pie chart, category breakdown, category monthly chart
- Tests date range filter for current month — verifies this agent's own expenses appear
- Tests empty state by selecting year 2020 — since the test accounts are newly created, no 2020 data exists; an empty chart is the correct expected result

**Overlap:** Does NOT assert exact totals against concurrent agents' data. Only verifies chart totals ≥ the sum this agent itself created. Uses current month as isolated assertion range.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-statistics.json` when done.

#### Settings Agent (runs last among the 7 personal-mode specialists)
**Wait condition:** Before starting, snapshot current settings (read `user_settings` for `qa-user-a` and store as `initial_settings`). Then poll all 6 completion signals:
`expenses`, `budget`, `goals`, `debts`, `recurring`, `statistics` (files in `/tmp/qa-signal-<name>.json`).
Poll every 5 seconds, timeout after 5 minutes. On timeout: log missing signals in report, proceed anyway.

**Primary:** Language switching (tests ≥2 languages including 1 RTL). Base currency change. Category manager: add, rename, delete a test category — never touch categories tagged `[seeded]` or matching `seedData.categoryIds`. Profile settings.
**Revert rule:** After each setting change, revert to the value from `initial_settings` before testing the next. Verify the revert succeeded before moving on. Final state must match `initial_settings`.
**Overlap:** After currency change, navigate to Expenses and Dashboard to verify new symbol propagates. After reverting, verify original symbol is restored. After RTL language, check layout direction on ≥2 pages before reverting.
**Completion signal:** Write `{ "complete": true }` to `/tmp/qa-signal-settings.json` when done.

### 4.3 Shared Expense Team (3 coordinated agents)

Run in parallel with personal-mode specialists (uses accounts B and C — no overlap with personal-mode User A agent). Each uses its own signal file.

**Signal files:**
- Shared-A writes to `/tmp/qa-signal-shared-a.json`
- Shared-B writes to `/tmp/qa-signal-shared-b.json`
- Shared-C writes to `/tmp/qa-signal-shared-c.json`

Each is a JSON object with checkpoint keys added as they are reached:
```json
{ "a_created_equal_split": true, "a_verified_rejection_behavior": true }
```

**Polling:** Read peer's signal file every 5 seconds, look for the required key.

**Timeout policy:** Signal not seen within 2 minutes → write CRITICAL bug: `"Coordination timeout waiting for <checkpoint> — peer agent may have crashed"`, skip remaining coordinated scenarios, proceed with fallback independent verifications.

**Debt model:** Each shared expense creates **independent debt records** per debtor (not an aggregated balance). When an agent pays a specific debt, it targets that debt's ID. C's payment in Scenario 5 targets the debt record created from the custom-split (Scenario 2), not a cumulative balance.

**Expected partial-approval behavior (Scenario 4):** The `shared_expenses` record remains `is_pending = true` with C still in `pending_with_users`. B's individual `debts` record exists. C has no debt record for this expense. A's shared expense list shows the expense still pending. If the app shows a different status label, note the actual label in the report (it is not a bug, just a documentation finding). If B's debt does not exist or C has a spurious debt, file a HIGH bug.

#### Shared-A Agent (qa-user-a — household owner)
**Wait-for-setup:** Poll `/tmp/qa-signal-setup.json` for `setup_complete` (same as personal-mode agents).
**Scenarios:**
1. Write `a_created_equal_split` → create 3-way equal-split shared expense (total $300) → wait for `b_approved_equal_split` + `c_approved_equal_split` → verify two debt records of $100 each on Debts page
2. Write `a_created_custom_split` → create custom-split ($100 total: A=50%, B=30%, C=20%) → wait for both approvals → verify B debt=$30, C debt=$20
3. Write `a_created_multicurrency_split` → create shared expense in EUR → wait for both approvals → verify A's view shows EUR amount + USD conversion
4. Write `a_created_partial_rejection_expense` → wait for `b_approved_partial_rejection` + `c_rejected_partial_rejection` → verify partial-approval behavior (see Section 3) → write `a_verified_rejection_behavior`
5. Write `a_recorded_b_partial_payment` → record B paid $50 toward B's equal-split debt ($100) → wait for `b_verified_partial_payment_drop`
6. Wait for `c_recorded_c_full_payment` → verify all debts from B and C to A are cleared → write `a_verified_all_settled`
**Fallback:** Verify A's Expenses list, Dashboard, and Statistics pages load without error.
**Overlap:** After `a_verified_all_settled`, check Expenses list and Statistics for settled shared expense accounting.

#### Shared-B Agent (qa-user-b — member)
**Wait-for-setup:** Poll `/tmp/qa-signal-setup.json` for `setup_complete`.
**Scenarios:**
1. Wait `a_created_equal_split` → approve → verify own debt = $100 → write `b_approved_equal_split`
2. Wait `a_created_custom_split` → approve → verify own debt = $30 → write `b_approved_custom_split`
3. Wait `a_created_multicurrency_split` → approve → verify debt in B's base currency (USD) with EUR→USD conversion → write `b_approved_multicurrency_split`
4. Wait `a_created_partial_rejection_expense` → approve → write `b_approved_partial_rejection`
5. Wait `a_recorded_b_partial_payment` → verify own equal-split debt dropped from $100 to $50 → write `b_verified_partial_payment_drop`
6. Wait `a_verified_all_settled` → verify Debts page shows no outstanding debt to A → write `b_verified_all_settled`
**Fallback:** Verify B's Dashboard, Expenses, and Debts pages load without error.
**Overlap:** Check Dashboard debt summary and Debts page after each state change.

#### Shared-C Agent (qa-user-c — member)
**Wait-for-setup:** Poll `/tmp/qa-signal-setup.json` for `setup_complete`.
**Scenarios:**
1. Wait `a_created_equal_split` → approve → verify own debt = $100 → write `c_approved_equal_split`
2. Wait `a_created_custom_split` → approve → verify own debt = $20 → write `c_approved_custom_split`
3. Wait `a_created_multicurrency_split` → approve → verify own debt in USD → write `c_approved_multicurrency_split`
4. Wait `a_created_partial_rejection_expense` *(not B's approval — C acts independently once A creates)* → reject → write `c_rejected_partial_rejection`
   *Rationale: C waits only for A's creation, not B's approval, because per-user actions are independent. This tests that C can reject after B has already approved.*
5. Wait `b_verified_partial_payment_drop` → record C's full payment of $20 (the custom-split debt record from Scenario 2, identified by debt ID) to A → write `c_recorded_c_full_payment`
6. Wait `a_verified_all_settled` → verify Debts page shows no outstanding debt to A → write `c_verified_all_settled`
**Fallback:** Verify C's Dashboard, Expenses, and Debts pages load without error.
**Overlap:** Check Statistics to verify shared expenses appear/excluded correctly for User C. Check Dashboard from C's perspective.

---

## 5. Coordination Protocol

### Session file: `/tmp/qa-session.json`
Written by Setup Agent. Read-only for all other agents.

### Signal files (per-agent — one writer per file, no write contention)
```
/tmp/qa-signal-setup.json       — Setup Agent
/tmp/qa-signal-expenses.json    — Expenses Agent
/tmp/qa-signal-budget.json      — Budget Agent
/tmp/qa-signal-goals.json       — Goals Agent
/tmp/qa-signal-debts.json       — Debts Agent
/tmp/qa-signal-recurring.json   — Recurring Agent
/tmp/qa-signal-statistics.json  — Statistics Agent
/tmp/qa-signal-settings.json    — Settings Agent
/tmp/qa-signal-shared-a.json    — Shared-A Agent
/tmp/qa-signal-shared-b.json    — Shared-B Agent
/tmp/qa-signal-shared-c.json    — Shared-C Agent
```

Each file is written atomically: write to `<name>.tmp`, then rename to final filename.

### Partial report files
Each agent writes independently to `/tmp/qa-report-<name>.md`:
`expenses`, `budget`, `goals`, `debts`, `recurring`, `statistics`, `settings`, `shared-a`, `shared-b`, `shared-c`

### Merge Agent (runs after all 10 specialists complete)
Triggered by the orchestrator after all 10 completion signals exist. Steps:
1. Read all 10 partial report files
2. Assign global sequential bug IDs (BUG-001, BUG-002, ...) sorted CRITICAL → HIGH → MEDIUM → LOW
3. Write final report to `docs/qa/bug-report-YYYY-MM-DD.md`
4. Stop the dev server process
5. Directly invoke the Fix Pipeline (Section 6) using the Skill tool — the Merge Agent is a Claude Code agent and has access to the Skill tool

---

## 6. Bug Report Format

**Output path:** `docs/qa/bug-report-YYYY-MM-DD.md`

**Severity scale:**
| Level | Meaning |
|---|---|
| CRITICAL | App crash, data loss, auth failure, flow completely blocked |
| HIGH | Feature broken, wrong data saved, workaround possible |
| MEDIUM | Missing validation, confusing UX, partial failure |
| LOW | Cosmetic issue, minor inconsistency |

**Bug entry template (all fields required; write "None" if not applicable):**
```markdown
### BUG-001 · CRITICAL · <Page/Feature>

**Agent:** <agent name>
**Route:** localhost:5173/<path>
**Steps to Reproduce:**
1. ...
2. ...
**Expected:** ...
**Actual:** ...
**Console Errors:** Paste errors/warnings from `browser_console_messages` captured during the failing steps. Write "None" if none were captured.
**Notes:** (additional context, screenshot paths, data state)
```

**Report header:**
```markdown
# BudgetMate QA Bug Report — YYYY-MM-DD

## Summary
- Total bugs: N
- CRITICAL: N | HIGH: N | MEDIUM: N | LOW: N
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts, Recurring Expenses,
  Statistics, Settings, Shared Expenses (3-user household)

## Bugs (sorted by severity)
```

---

## 7. Fix Pipeline (Automatic, Post-Report)

Invoked directly by the Merge Agent (a Claude Code agent) after stopping the dev server.

```
Dev server stopped + Bug Report written
       ↓
git checkout -b qa-fixes-YYYY-MM-DD
       ↓
Parse report → order bugs by severity (CRITICAL first)
       ↓
Invoke Skill: superpowers:writing-plans
  Context: bug report file path + list of bugs
  Output: docs/superpowers/plans/YYYY-MM-DD-qa-fixes.md
  Format: one numbered plan step per bug, ordered by severity
       ↓
Invoke Skill: superpowers:executing-plans
  Input: plan document path
  Behavior: applies code fixes for each plan step in order;
            marks each step [DONE] in the plan file upon completion
       ↓
[ MANUAL ] User reviews branch and merges to main
```

**Branch naming:** `qa-fixes-YYYY-MM-DD`

**Re-invocation after a blocker:** Steps marked `[DONE]` in the plan file are skipped on re-invocation. The pipeline resumes from the first non-`[DONE]` step.

**Blocker criteria — when to halt vs. proceed autonomously:**

| Type of fix | Action |
|---|---|
| CSS/styling bug, wrong color, layout glitch | Fix autonomously |
| Missing UI validation (e.g., empty field not rejected) | Fix autonomously |
| Logic error in calculation (e.g., wrong total, wrong split) | Fix autonomously |
| Fix requires a new database column or schema change | HALT — write blocker |
| Fix requires deciding between two conflicting UX approaches | HALT — write blocker |
| Bug description is ambiguous (can't determine expected vs. actual) | HALT — write blocker |
| Two bugs require contradictory changes to the same file | HALT — write blocker |

**On halt:** Write `docs/qa/fix-pipeline-blocked.md`:
```markdown
# Fix Pipeline Blocked

## BUG-XXX — <reason>
**Decision needed:** <specific question for the user>
**Plan step:** Step N in docs/superpowers/plans/YYYY-MM-DD-qa-fixes.md
```
Then halt. User resolves, edits the plan if needed, and re-invokes `superpowers:executing-plans`.

---

## 8. Implementation Notes

- All agents use Playwright MCP tools: `browser_navigate`, `browser_click`, `browser_fill_form`, `browser_snapshot`, `browser_take_screenshot`, `browser_wait_for`, `browser_console_messages`
- Each specialist agent opens its own independent browser session — no shared browser sessions
- Signal files are written atomically (`.tmp` → rename) to prevent JSON corruption
- The Settings Agent waits for all 6 personal-mode agents before starting (5-minute timeout)
- The Shared Expense Team agents wait for `setup_complete` but otherwise run concurrently with personal-mode specialists
- The Merge Agent waits for all 10 completion signal files before assembling the report
- The fix pipeline (Phase 2) is pure code editing on the `qa-fixes-YYYY-MM-DD` branch — no browser interaction required
