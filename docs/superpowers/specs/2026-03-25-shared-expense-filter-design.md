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

### 1. New query — fetch splits

```js
const { data: splits = [] } = useQuery({
  queryKey: ['sharedExpenseSplits', user?.email],
  queryFn: () => base44.entities.SharedExpenseSplit.list(),
  enabled: !!user?.email,
});
```

### 2. New memo — participant map

```js
const splitParticipantsMap = useMemo(() => {
  const map = new Map(); // shared_expense_id → Set<user_id>
  for (const split of splits) {
    if (!map.has(split.shared_expense_id)) {
      map.set(split.shared_expense_id, new Set());
    }
    map.get(split.shared_expense_id).add(split.user_id);
  }
  return map;
}, [splits]);
```

### 3. Fix `sharedUsers` memo

Replace the existing logic (which reads `paid_by_user_id`) with one that reads from `splits`:

```js
const sharedUsers = useMemo(() => {
  const userMap = new Map();
  for (const split of splits) {
    if (split.user_id === user?.email) continue;
    if (!userMap.has(split.user_id)) {
      userMap.set(split.user_id, { email: split.user_id, name: split.user_name || split.user_id });
    }
  }
  return Array.from(userMap.values());
}, [splits, user?.email]);
```

### 4. Fix `sharedWithUser` filter block in `filteredExpenses`

Replace:
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
    if (!e.source_shared_expense_id) return false;
    const participants = splitParticipantsMap.get(e.source_shared_expense_id);
    return participants?.has(selectedUser);
  });
}
```

## Data Flow

```
SharedExpenseSplit (splits)
  → splitParticipantsMap: Map<shared_expense_id, Set<user_id>>
  → sharedUsers: dropdown options (all co-participants, excluding self)
  → filteredExpenses: keep expense if its source SharedExpense has selectedUser as participant
```

## Files Changed

- `src/pages/Expenses.jsx` — only file affected
