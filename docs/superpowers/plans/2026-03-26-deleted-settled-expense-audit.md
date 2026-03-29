# Deleted Settled Expense Audit Trail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `deleted_settled_expenses` DB table that records when settled shared expenses are deleted, and display contextual "reversed debt" badges in the Debts page so users understand why a new debt appeared after deleting a previously settled expense.

**Architecture:** When a settled shared expense is deleted, the app already creates reverse SharedExpenses (making the original payer now owe the participants). This plan adds: (1) a `deleted_settled_expenses` audit table that stores each reverse SharedExpense's origin, (2) a query in Debts.tsx that fetches these records, and (3) a UI badge on expense rows in the detail modal explaining the origin. The link between a reverse SharedExpense and its audit record is stored as `reverse_shared_expense_id` in `deleted_settled_expenses`.

**Tech Stack:** Supabase (PostgreSQL), React 18, TanStack React Query, TypeScript, Tailwind CSS, Lucide React

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/007_deleted_settled_expenses.sql` | Create | DB migration for new audit table |
| `src/api/base44Client.js` | Modify | Register `DeletedSettledExpense` entity |
| `src/pages/Debts.tsx` | Modify | Save audit records on delete; query & display badges |
| `src/components/i18n/LanguageContext.jsx` | Modify | Add translation keys for new badge text |

---

### Task 1: Create DB Migration

**Files:**
- Create: `supabase/migrations/007_deleted_settled_expenses.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Migration: 007_deleted_settled_expenses
-- Creates audit table that records deleted settled shared expenses
-- and links them to the reverse SharedExpense that was created.

CREATE TABLE IF NOT EXISTS deleted_settled_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_shared_expense_id TEXT NOT NULL,
  reverse_shared_expense_id TEXT NOT NULL,
  description TEXT,
  total_amount NUMERIC,
  date DATE,
  category_name TEXT,
  original_paid_by_user_id TEXT,
  original_paid_by_user_name TEXT,
  participant_user_id TEXT,
  participant_user_name TEXT,
  participant_share_amount NUMERIC,
  deleted_by_user_id TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- RLS: users can read/insert their own records
ALTER TABLE deleted_settled_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read deleted_settled_expenses they are involved in"
  ON deleted_settled_expenses
  FOR SELECT
  USING (
    auth.uid()::text = deleted_by_user_id
    OR auth.uid()::text = original_paid_by_user_id
    OR auth.uid()::text = participant_user_id
    OR auth.email() = deleted_by_user_id
    OR auth.email() = original_paid_by_user_id
    OR auth.email() = participant_user_id
  );

CREATE POLICY "Users can insert deleted_settled_expenses"
  ON deleted_settled_expenses
  FOR INSERT
  WITH CHECK (auth.email() = deleted_by_user_id OR auth.uid()::text = deleted_by_user_id);
```

- [ ] **Step 2: Apply migration via Supabase MCP**

Use `mcp__supabase__apply_migration` with name `deleted_settled_expenses` and the SQL above.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/007_deleted_settled_expenses.sql
git commit -m "feat: add deleted_settled_expenses audit table migration"
```

---

### Task 2: Register Entity in base44Client

**Files:**
- Modify: `src/api/base44Client.js:4-20`

- [ ] **Step 1: Add `DeletedSettledExpense` to tableMap**

In `src/api/base44Client.js`, add to `tableMap`:
```js
DeletedSettledExpense: 'deleted_settled_expenses',
```

The final tableMap should look like:
```js
const tableMap = {
  Budget: 'budgets',
  Category: 'categories',
  Debt: 'debts',
  DeletedSettledExpense: 'deleted_settled_expenses',
  Expense: 'expenses',
  UserProfile: 'user_profiles',
  UserSettings: 'user_settings',
  RecurringExpense: 'recurring_expenses',
  SharedExpense: 'shared_expenses',
  SharedExpenseApproval: 'shared_expense_approvals',
  SharedExpenseSplit: 'shared_expense_splits',
  Notification: 'notifications',
  AlwaysApprovedUser: 'always_approved_users',
  SavingsGoal: 'savings_goals',
  Household: 'households',
  User: 'user_profiles',
};
```

- [ ] **Step 2: Commit**

```bash
git add src/api/base44Client.js
git commit -m "feat: register DeletedSettledExpense entity in base44Client"
```

---

### Task 3: Add Translation Keys

**Files:**
- Modify: `src/components/i18n/LanguageContext.jsx`

- [ ] **Step 1: Find where translation objects are defined**

Grep for `settled_history` in `src/components/i18n/LanguageContext.jsx` to find the translation key structure, then add:

For English (and all language objects that exist):
```
reversed_from_deleted: 'Reversed from deleted expense',
original_expense_deleted: 'This debt exists because a settled expense was deleted',
```

- [ ] **Step 2: Commit**

```bash
git add src/components/i18n/LanguageContext.jsx
git commit -m "feat: add reversed_from_deleted translation keys"
```

---

### Task 4: Save Audit Records When Deleting a Settled Expense

**Files:**
- Modify: `src/pages/Debts.tsx` — inside `deleteSharedExpenseMutation.mutationFn`, in the `if (shared.is_settled)` branch

- [ ] **Step 1: After creating `reverseExpense`, save an audit record**

In `deleteSharedExpenseMutation.mutationFn`, inside the `for (const split of splits)` loop in the `if (shared.is_settled)` block, immediately after `const reverseExpense = await base44.entities.SharedExpense.create({...})`, add:

```typescript
// Save audit record linking the reverse expense back to the original
await base44.entities.DeletedSettledExpense.create({
  original_shared_expense_id: shared.id,
  reverse_shared_expense_id: reverseExpense.id,
  description: shared.description || shared.category_name || '',
  total_amount: shared.total_amount,
  date: shared.date,
  category_name: shared.category_name || '',
  original_paid_by_user_id: paidByUserIdTrimmed,
  original_paid_by_user_name: payerName,
  participant_user_id: splitUserIdTrimmed,
  participant_user_name: split.user_name,
  participant_share_amount: split.share_amount,
  deleted_by_user_id: userEmail,
});
```

- [ ] **Step 2: Build to check types**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors related to the new code.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Debts.tsx
git commit -m "feat: save DeletedSettledExpense audit record on settled expense delete"
```

---

### Task 5: Query and Display Audit Records in Debts Page

**Files:**
- Modify: `src/pages/Debts.tsx`

- [ ] **Step 1: Add query for `deletedSettledExpenses`**

After the existing `allDebts` query (around line 73), add:

```typescript
const { data: deletedSettledExpenses = [] } = useQuery({
  queryKey: ['deletedSettledExpenses', user?.email],
  queryFn: async () => {
    if (!user?.email) return [];
    return base44.entities.DeletedSettledExpense.list();
  },
  enabled: !!user?.email,
});
```

- [ ] **Step 2: Build a lookup set for reverse expense IDs**

After `const userEmail = user?.email?.trim();` (around line 84), add:

```typescript
// Set of reverse_shared_expense_ids so we can annotate those expense rows
const reversedExpenseIds = new Set<string>(
  (deletedSettledExpenses as any[]).map((r: any) => r.reverse_shared_expense_id).filter(Boolean)
);

// Map from reverse_shared_expense_id → audit record (for detail display)
const reversedExpenseAuditMap = new Map<string, any>(
  (deletedSettledExpenses as any[])
    .filter((r: any) => r.reverse_shared_expense_id)
    .map((r: any) => [r.reverse_shared_expense_id, r])
);
```

- [ ] **Step 3: Annotate expense rows in the detail modal**

In the `selectedUserExpenses.map((expense) => { ... })` block (around line 845), after the existing `is_settled` badge (the `{expense.is_settled && ...}` block), add:

```tsx
{reversedExpenseIds.has(expense.id) && (() => {
  const audit = reversedExpenseAuditMap.get(expense.id);
  return (
    <div className="mt-2">
      <span
        className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit"
        title={audit ? `Original expense: ${audit.description || audit.category_name || ''}  |  Original payer: ${audit.original_paid_by_user_name || audit.original_paid_by_user_id}` : ''}
      >
        <Receipt className="h-3 w-3" />
        {(t as any).reversed_from_deleted || 'Reversed from deleted expense'}
      </span>
    </div>
  );
})()}
```

- [ ] **Step 4: Invalidate query on delete success**

In `deleteSharedExpenseMutation.onSuccess`, add:
```typescript
queryClient.invalidateQueries({ queryKey: ['deletedSettledExpenses'] });
```

- [ ] **Step 5: Build**

```bash
npm run build 2>&1 | tail -20
```

Expected: clean build.

- [ ] **Step 6: Run lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Debts.tsx
git commit -m "feat: show reversed-from-deleted badge on shared expense rows in Debts page"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Build**

```bash
npm run build 2>&1 | tail -30
```

Expected: exit code 0, no errors.

- [ ] **Step 2: Lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: exit code 0.

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck 2>&1 | tail -20
```

Expected: exit code 0.

- [ ] **Step 4: Commit and push**

```bash
git push -u origin feat/deleted-settled-expense-audit-2026-03-26
```
