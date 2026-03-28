---
name: bugfix
description: This skill should be used when the user asks to "fix a bug", "debug an issue", "something is broken", "it's not working", "investigate why X happens", or reports unexpected behavior in the app. Enforces a reproduce-first, verify-last workflow to avoid wrong-approach iterations.
version: 0.1.0
---

# Bug Fix Skill

Enforce a strict reproduce → root cause → fix → verify cycle. Never jump to a solution before understanding the problem. Never claim a bug is fixed before running the build and tests.

## Workflow

### Step 1 — Reproduce First

Before touching any code:

1. Read all files relevant to the reported symptom (component, data layer, types)
2. Trace the execution path from user action → data → render
3. State the reproduction steps in one sentence: "When X happens, Y occurs instead of Z"

If the bug cannot be reproduced or understood from reading code alone, write a Playwright test or unit test that **fails** to confirm the issue is real before proceeding.

### Step 2 — Identify Root Cause

Do not fix symptoms. Find the root:

- Check for JS falsy pitfalls: `0`, `""`, `null`, `undefined` — use `=== null` / `=== undefined`, never `!value`
- Check for stale closures in React hooks (`useCallback`, `useEffect` deps arrays)
- Check for SharedExpense/Debt dependency: the Debts page derives balances from `SharedExpense` records — never delete records assuming they are unused
- Check for wrong component: verify the component being edited is actually the one rendered in the affected flow (e.g. `UnifiedExpenseDialog` vs `SharedExpenseDialog`)

State the root cause explicitly before writing any fix.

### Step 3 — Implement the Minimal Fix

- Change only what is necessary to fix the root cause
- Do not refactor, clean up, or improve surrounding code
- Do not add error handling for scenarios that cannot happen

### Step 4 — Verify

Run in order:

```bash
npm run build
npm run typecheck
```

For UI bugs, run the specific Playwright test file:

```bash
npx playwright test <relevant-spec>
```

Do **not** mark the bug as fixed until:
- `npm run build` exits with no errors
- The reproduction scenario no longer triggers the bug

If verification fails, go back to Step 2 — do not retry the same fix blindly.

## Common Root Causes in This Codebase

| Symptom | Likely Cause |
|---|---|
| Filter/count shows wrong number | Falsy check on `0` amount or empty string category |
| Debts page shows wrong balance | SharedExpense record deleted or direction reversed |
| Dialog editing wrong record | Wrong component targeted (check `pages.config.js` route → component chain) |
| Stale data after mutation | React Query cache not invalidated (`queryClient.invalidateQueries`) |
| Form field resets unexpectedly | `defaultValues` not memoized or `reset()` called on wrong render |
| RTL/Hebrew layout broken | Missing `dir="rtl"` or hardcoded `left`/`right` CSS instead of `start`/`end` |

## What NOT to Do

- Do not produce a plan and wait for approval — implement the fix directly
- Do not use `!value` for numeric or string checks
- Do not delete `SharedExpense` records without tracing Debts page dependencies
- Do not mark done without running `npm run build`
- Do not fix multiple unrelated bugs in a single session — one bug per fix cycle
