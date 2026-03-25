# Shared Expense Filter Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "shared with user" filter on the Expenses page so it shows all of User A's expense rows shared with User B, regardless of who paid.

**Architecture:** Add a `SharedExpenseSplit` query to fetch participant data, build a `splitParticipantsMap` memo from it, then use that map in both the `filteredExpenses` filter and the `sharedUsers` dropdown. All changes are in one file.

**Tech Stack:** React 18, TanStack Query (`useQuery`, `useMemo`), Supabase via `base44Client`

---

## File Map

| File | Change |
|------|--------|
| `src/pages/Expenses.jsx` | Add splits query (line ~132), add `splitParticipantsMap` memo (line ~150), fix `filteredExpenses` filter block (lines 785–797) + deps (line 814), replace `sharedUsers` memo (lines 839–853) |

---

### Task 1: Add the `SharedExpenseSplit` query

**Files:**
- Modify: `src/pages/Expenses.jsx:125-132`

- [ ] **Step 1: Add the splits query after the existing `sharedExpensesList` query**

In `src/pages/Expenses.jsx`, after line 132 (the closing `});` of the `sharedExpensesList` query), insert:

```js
// Fetch all splits to build participant map for shared-with-user filter
const { data: splits = [] } = useQuery({
  queryKey: ['sharedExpenseSplits', user?.email],
  queryFn: () => base44.entities.SharedExpenseSplit.list(),
  enabled: !!user?.email,
});
```

- [ ] **Step 2: Verify the app compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "feat: fetch SharedExpenseSplit data for shared-with-user filter"
```

---

### Task 2: Add `splitParticipantsMap` memo

**Files:**
- Modify: `src/pages/Expenses.jsx:149-150`

- [ ] **Step 1: Insert the memo after `settledSharedExpenseIds` (after line 149)**

After the closing `}, [sharedExpensesList]);` of `settledSharedExpenseIds` (line 149), insert:

```js
// Map each shared_expense_id to the Set of all participant user_ids.
// Step 1: find which shared_expense_ids the current user participates in.
// Step 2: build Sets only for those IDs (scopes the map to current user's expenses).
const splitParticipantsMap = useMemo(() => {
  const mySharedExpenseIds = new Set(
    splits
      .filter(s => s.user_id === user?.email)
      .map(s => s.shared_expense_id)
  );
  const map = new Map();
  for (const split of splits) {
    if (!mySharedExpenseIds.has(split.shared_expense_id)) continue;
    if (!map.has(split.shared_expense_id)) {
      map.set(split.shared_expense_id, new Set());
    }
    map.get(split.shared_expense_id).add(split.user_id);
  }
  return map;
}, [splits, user?.email]);
```

- [ ] **Step 2: Verify the app compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "feat: build splitParticipantsMap from SharedExpenseSplit data"
```

---

### Task 3: Fix the `sharedWithUser` filter block and dependency array

**Files:**
- Modify: `src/pages/Expenses.jsx:785-814`

- [ ] **Step 1: Replace the `sharedWithUser` else-if block**

Locate this block (lines 785–797):

```js
} else if (filters.sharedWithUser) {
  // Show shared expenses involving the specific user in any role
  // (either they paid for the expense, or the expense is attributed to their account)
  const selectedUser = filters.sharedWithUser;
  result = result.filter(e =>
    e.is_shared && (
      e.paid_by_user_id === selectedUser ||
      e.user_email === selectedUser ||
      (Array.isArray(e.shared_with) && e.shared_with.includes(selectedUser)) ||
      (Array.isArray(e.participants) && e.participants.includes(selectedUser))
    )
  );
}
```

Replace it with:

```js
} else if (filters.sharedWithUser) {
  const selectedUser = filters.sharedWithUser;
  result = result.filter(e => {
    if (!e.is_shared) return false;
    // Expenses with is_shared=true but no source_shared_expense_id are legacy records — skip.
    if (!e.source_shared_expense_id) return false;
    const participants = splitParticipantsMap.get(e.source_shared_expense_id);
    return participants?.has(selectedUser);
  });
}
```

- [ ] **Step 2: Add `splitParticipantsMap` to the `filteredExpenses` dependency array**

Locate line 814:
```js
  }, [expenses, filters, sharedExpenseStatusMap]);
```

Replace with:
```js
  }, [expenses, filters, sharedExpenseStatusMap, splitParticipantsMap]);
```

- [ ] **Step 3: Verify the app compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "fix: use splitParticipantsMap in sharedWithUser filter"
```

---

### Task 4: Fix the `sharedUsers` dropdown memo

**Files:**
- Modify: `src/pages/Expenses.jsx:839-853`

- [ ] **Step 1: Replace the `sharedUsers` memo**

Locate this entire memo (lines 839–853):

```js
const sharedUsers = useMemo(() => {
  const userMap = new Map();
  expenses.forEach(e => {
    if (!e.is_shared) return;
    const otherId = e.paid_by_user_id && e.paid_by_user_id !== user?.email
      ? e.paid_by_user_id
      : e.user_email && e.user_email !== user?.email
      ? e.user_email
      : null;
    if (otherId && !userMap.has(otherId)) {
      userMap.set(otherId, { email: otherId, name: otherId });
    }
  });
  return Array.from(userMap.values());
}, [expenses, user?.email]);
```

Replace it with:

```js
// Build dropdown options from splitParticipantsMap — surfaces all co-participants
// including those from expenses where the current user was the payer.
const sharedUsers = useMemo(() => {
  const userMap = new Map();
  for (const [, participants] of splitParticipantsMap) {
    for (const userId of participants) {
      if (userId === user?.email) continue; // skip self
      if (!userMap.has(userId)) {
        const split = splits.find(s => s.user_id === userId);
        userMap.set(userId, { email: userId, name: split?.user_name || userId });
      }
    }
  }
  return Array.from(userMap.values());
}, [splitParticipantsMap, splits, user?.email]);
```

- [ ] **Step 2: Verify the app compiles**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: no new lint errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server:
```bash
npm run dev
```

1. Go to the Expenses page
2. Open the "shared with" filter dropdown — verify co-participants appear (including users where you were the payer)
3. Select a co-participant — verify both directions of shared expenses appear (expenses you paid + expenses they paid)
4. Compare with "All Shared" option — the specific-user filter should be a subset of that

- [ ] **Step 5: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "fix: show all shared expenses in filter regardless of who paid"
```
