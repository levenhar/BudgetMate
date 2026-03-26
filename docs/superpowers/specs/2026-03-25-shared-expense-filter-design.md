# Shared Expense Filter Fix — Design Spec

**Date:** 2026-03-25
**Status:** Approved

## Problem

In the Expenses page, when filtering by "shared with user", only expenses where the other user **paid** appear. Expenses where the **current user paid** (but the other user is a participant) are excluded.

**Root cause:** The `sharedUsers` dropdown and filter both relied solely on `paid_by_user_id` to identify the other participant. When the current user is the payer, `paid_by_user_id === user.email`, so the other participant is never discovered. The `shared_with` / `participants` array fields checked by the filter do not exist on `Expense` records.

## Goal

When User A filters by "shared with User B", show all of User A's expense rows linked to a shared expense that includes User B as a participant — regardless of who paid.

One row per shared expense (User A's share), both directions covered.

## Approach

Use `SharedExpenseSplit` as the authoritative source of participant data. No data model changes required.

## Changes — `src/pages/Expenses.jsx`

### 1. New query — fetch all splits

Add this query alongside the existing `sharedExpensesList` query (~line 125). Fetch all splits unscoped — the memos below will restrict usage to only shared expenses the current user is part of.

```js
const { data: splits = [] } = useQuery({
  queryKey: ['sharedExpenseSplits', user?.email],
  queryFn: () => base44.entities.SharedExpenseSplit.list(),
  enabled: !!user?.email,
});
```

### 2. New memo — participant map

Declare this **before** the `filteredExpenses` memo (after `settledSharedExpenseIds`, ~line 150), as `filteredExpenses` depends on it.

Strategy: first identify which `shared_expense_id` values the current user participates in, then build the map from only those entries. This ensures `sharedUsers` and the filter are scoped to the current user's shared expenses, even though the raw splits list is unscoped.

```js
const splitParticipantsMap = useMemo(() => {
  // Step 1: find all shared_expense_ids where current user is a participant
  const mySharedExpenseIds = new Set(
    splits
      .filter(s => s.user_id === user?.email)
      .map(s => s.shared_expense_id)
  );

  // Step 2: build participant sets only for those shared expenses
  const map = new Map(); // shared_expense_id → Set<user_id>
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

Each Set in the map contains all participant `user_id` values (including the current user) for a given shared expense.

### 3. Fix `sharedWithUser` filter block in `filteredExpenses`

The `all_shared` branch (`filters.sharedWithUser === 'all_shared'`) is intentionally left unchanged — it already correctly shows all `is_shared` expenses regardless of payer.

Replace the specific-user branch:
```js
} else if (filters.sharedWithUser) {
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

With:
```js
} else if (filters.sharedWithUser) {
  const selectedUser = filters.sharedWithUser;
  result = result.filter(e => {
    if (!e.is_shared) return false;
    // Expenses with is_shared=true but no source_shared_expense_id are legacy/
    // data-integrity edge cases — skip them as they have no split data to check.
    if (!e.source_shared_expense_id) return false;
    const participants = splitParticipantsMap.get(e.source_shared_expense_id);
    return participants?.has(selectedUser);
  });
}
```

Also update the `filteredExpenses` memo dependency array to include `splitParticipantsMap`:

```js
}, [expenses, filters, sharedExpenseStatusMap, splitParticipantsMap]);
```

Without this, the filter will silently use a stale (empty) map on first render since splits load asynchronously after expenses.

### 4. Fix `sharedUsers` memo (~line 839)

Replace the existing logic (which reads `paid_by_user_id`) with one that reads from `splitParticipantsMap`. Collect all non-self participants across all shared expenses the current user is part of.

```js
const sharedUsers = useMemo(() => {
  const userMap = new Map();
  for (const [, participants] of splitParticipantsMap) {
    for (const userId of participants) {
      if (userId === user?.email) continue; // skip self
      if (!userMap.has(userId)) {
        // Find the user_name from splits
        const split = splits.find(s => s.user_id === userId);
        userMap.set(userId, { email: userId, name: split?.user_name || userId });
      }
    }
  }
  return Array.from(userMap.values());
}, [splitParticipantsMap, splits, user?.email]);
```

Because `splitParticipantsMap` is already scoped to the current user's shared expenses, this dropdown will only show genuine co-participants — not all users in the system.

## Declaration Order in File

The new declarations must appear in this order:

1. `splits` query — alongside existing `sharedExpensesList` query (~line 125)
2. `splitParticipantsMap` memo — after `settledSharedExpenseIds` (~line 150), **before** `filteredExpenses`
3. `filteredExpenses` memo — updated filter block + `splitParticipantsMap` in deps (~line 746)
4. `sharedUsers` memo — replaced (~line 839), depends on `splitParticipantsMap`

## Data Flow

```
SharedExpenseSplit.list() (all splits, unscoped)
  → splitParticipantsMap: scoped to shared expenses where current user participates
      Map<shared_expense_id, Set<user_id>>  (includes current user + all co-participants)
  → sharedUsers: iterate map, skip self → dropdown of genuine co-participants
  → filteredExpenses[sharedWithUser]: keep expense if its SharedExpense has selectedUser in participants Set
```

## Files Changed

- `src/pages/Expenses.jsx` — only file affected
