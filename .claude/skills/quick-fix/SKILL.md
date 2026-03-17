---
name: quick-fix
description: This skill should be used when the user asks to "fix a small bug", "add a small feature", "quick fix", "minor UI change", "small tweak", "tiny improvement", "adjust the UI", "fix this issue", or any similarly scoped task that requires minimal code changes in the BudgetMate project.
version: 0.1.0
---

# Quick Fix Skill

For small, targeted bug fixes and minor UI feature additions in BudgetMate. The guiding principle is **minimum viable change** — touch only what is necessary.

## Workflow

### 1. Identify the Exact Issue

Before touching any code:

- Read the specific file(s) involved — never guess at the implementation
- Confirm the root cause with a single Grep or Read, not a full exploration
- Define the one-line fix in your head before opening an editor

### 2. Make Minimal Changes

- Change only the lines directly responsible for the bug or feature
- Do not refactor surrounding code, rename variables, or improve formatting
- Do not add error handling, comments, or abstractions not strictly required
- Do not touch files unrelated to the fix

**One file changed is better than two. One line changed is better than ten.**

### 3. Verify

Run the build after every fix:

```bash
npm run build
```

If the build fails, fix only the build error — do not reorganize code.

### 4. Report Concisely

After completing, state:
- Which file(s) changed and which line(s)
- What the fix does in one sentence
- Nothing else unless the user asks

## What to Avoid

- Over-engineering: no new abstractions, hooks, or utilities for a one-off fix
- Scope creep: if you notice other issues while fixing, mention them but do not fix them
- Unnecessary comments or documentation
- Style or formatting changes not related to the fix
- Adding new dependencies

## BudgetMate-Specific Notes

- UI components live in `src/components/ui/` (Shadcn/UI primitives) and `src/components/` (feature components)
- Pages are in `src/pages/` — one file per route
- Use `@/` alias for all imports
- Icons: Lucide React only
- Toasts: Sonner (`toast.success`, `toast.error`)
- Styling: Tailwind CSS utility classes — prefer editing existing classes over adding new ones
