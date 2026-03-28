---
name: preflight
description: This skill should be used when the user asks to "scope this task", "pre-flight check", "what files are involved", "plan before implementing", "check before coding", "how complex is this", or wants to validate assumptions before touching any code. Produces a compact action plan and waits for explicit approval before any implementation begins.
version: 0.1.0
---

# Preflight Skill

Produce a 5-point validation checklist before any code changes. Do NOT write any code until the user replies "go". This prevents the pattern of sessions that end with only exploration and no implementation.

## Checklist (output all 5 points before stopping)

**1. Entry Points** — Identify the exact files and functions to modify, with line numbers.
- Read the relevant components and trace the execution path
- Name the specific component, not a guess (e.g. `UnifiedExpenseDialog` not `SharedExpenseDialog`)
- List every file that will change

**2. Approach** — Describe the change in ≤50 words per file.
- Be concrete: "Add `is_favorite` boolean field to the filter in `base44.entities.Expense.filter()`"
- Not vague: "Update the expense logic"

**3. Risk Check** — What could break?
- Which other components consume the same data or props?
- Check for SharedExpense/Debt dependencies (Debts page derives balances from SharedExpense records)
- Check for falsy pitfalls: does any numeric or boolean field need explicit `=== null` checks?
- Name the existing Playwright spec files that cover this area (or note there are none)

**4. Scope** — Classify as:
- **Small** (<3 files, <30 lines changed)
- **Medium** (3–6 files, 30–100 lines)
- **Large** (7+ files or >100 lines) → suggest how to split into smaller increments

**5. Validation Plan** — Exact commands to run after implementation:
```bash
npm run build
npm run typecheck
npx playwright test <relevant-spec>
```

## Output Format

Present the checklist as a compact table or numbered list. End with:

> **Waiting for "go".** Reply "go" to begin implementation, or ask questions to refine the plan.

Do NOT start implementing until the user explicitly replies "go" (or equivalent confirmation).

## When to Skip This Skill

- Trivial one-liner fixes where the file and change are already known
- User explicitly says "just do it" or "skip preflight"
- Already inside an active implementation session with a confirmed plan
