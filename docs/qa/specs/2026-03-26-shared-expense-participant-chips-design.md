# Shared Expense Participant Avatar Chips

**Date:** 2026-03-26
**Branch:** feat/shared-expense-participant-chips
**Status:** Approved

## Summary

In the expanded detail panel of a shared expense row on the Expenses page, show the list of participants as small avatar chips — Google profile photo if available, falling back to initials.

---

## Data Layer

### 1. `UserProfile` table — add `picture_url`

Add a nullable `picture_url` text column to the `user_profiles` table in Supabase.

### 2. `Setting.jsx` — persist photo on login

The existing auto-upsert hook in `Setting.jsx` already runs when the user visits settings (and on first login). Extend it to also write `picture_url` from `user.picture` (sourced from `user_metadata.picture` or `user_metadata.avatar_url` — the Google OAuth photo URL).

```js
await base44.entities.UserProfile.update(existing[0].id, {
  full_name: user.full_name || '',
  picture_url: user.picture || null,
});
```

### 3. `Expenses.jsx` — build participant details map

Add one new React Query:
```js
const { data: userProfiles = [] } = useQuery({
  queryKey: ['userProfiles'],
  queryFn: () => base44.entities.UserProfile.list(),
  enabled: !!user?.email,
});
```

Build a derived lookup map:
```js
const userProfileMap = useMemo(() =>
  new Map(userProfiles.map(p => [p.user_email, {
    name: p.full_name || p.user_email,
    picture_url: p.picture_url || null,
  }])),
  [userProfiles]
);
```

Refactor `splitParticipantsMap` from `Map<id, Set<email>>` to `Map<id, Array<{email, name, picture_url}>>`:
```js
const splitParticipantsMap = useMemo(() => {
  const mySharedExpenseIds = new Set(
    splits.filter(s => s.user_id === user?.email).map(s => s.shared_expense_id)
  );
  const map = new Map();
  for (const split of splits) {
    if (!mySharedExpenseIds.has(split.shared_expense_id)) continue;
    if (!map.has(split.shared_expense_id)) map.set(split.shared_expense_id, []);
    const profile = userProfileMap.get(split.user_id);
    map.get(split.shared_expense_id).push({
      email: split.user_id,
      name: profile?.name || split.user_name || split.user_id,
      picture_url: profile?.picture_url || null,
    });
  }
  return map;
}, [splits, user?.email, userProfileMap]);
```

The existing `sharedWithUser` filter used `splitParticipantsMap` as a `Set<email>`. After this refactor, derive the set inline:
```js
const participants = splitParticipantsMap.get(e.source_shared_expense_id);
// was: participants?.has(filters.sharedWithUser)
// now: participants?.some(p => p.email === filters.sharedWithUser)
```

---

## Component Changes

### `ExpenseCard.jsx` — new `sharedParticipants` prop

Add prop:
```js
sharedParticipants: Array<{ email: string, name: string, picture_url: string | null }>
```

Replace the existing "Shared info" row in the expanded panel with avatar chips.

`TooltipProvider` is not globally wrapped in the app — wrap it locally around the chips section. Tooltip shows the participant's email on hover (nice-to-have; names are already visible inline).

```jsx
{expense.is_shared && sharedParticipants?.length > 0 && (
  <div className="flex items-center gap-2 col-span-2">
    <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
    <span className="text-slate-500">{t.shared_with || 'Shared with'}:</span>
    <TooltipProvider delayDuration={300}>
    <div className="flex flex-wrap gap-1">
      {sharedParticipants.map(p => {
        const isMe = p.email === currentUserEmail;
        const label = isMe ? (t.you || 'You') : p.name;
        const initials = getInitials(label);
        return (
          <Tooltip key={p.email}>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 bg-slate-100 rounded-full px-1.5 py-0.5">
                <Avatar className="w-4 h-4">
                  <AvatarImage src={p.picture_url} />
                  <AvatarFallback className="text-[8px]">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-slate-600 leading-none">{label}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>{isMe ? p.email : `${p.name} · ${p.email}`}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
    </TooltipProvider>
  </div>
)}
```

Helper (inside component file):
```js
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
```

The old "Paid by X" text is removed from this row; paid-by info is already visible in the inline badge on the row itself.

### `Expenses.jsx` — pass prop to `<ExpenseCard>`

```jsx
sharedParticipants={
  expense.source_shared_expense_id
    ? (splitParticipantsMap.get(expense.source_shared_expense_id) ?? [])
    : []
}
```

---

## Edge Cases

| Scenario | Behaviour |
|---|---|
| No `picture_url` for a participant | `AvatarFallback` shows initials |
| `sharedParticipants` empty or undefined | "Shared with" row hidden entirely |
| Legacy expense (`is_shared` but no `source_shared_expense_id`) | Row hidden (no regression) |
| Current user in participant list | Label shows "You" / `t.you` |
| Single-word name or email as name | First 2 chars used as initials |
| `UserProfile` not yet created for a participant | Falls back to `split.user_name` or email |

---

## Files to Change

| File | Change |
|---|---|
| `src/pages/Setting.jsx` | Add `picture_url` to UserProfile upsert |
| `src/pages/Expenses.jsx` | Add `userProfiles` query, build `userProfileMap`, refactor `splitParticipantsMap`, fix `sharedWithUser` filter, pass `sharedParticipants` to `<ExpenseCard>` |
| `src/components/ui/ExpenseCard.jsx` | Add `sharedParticipants` prop, add `getInitials` helper, replace "Shared info" row with avatar chips |
| Supabase migration | Add `picture_url` column to `user_profiles` table |

---

## Out of Scope

- Updating `picture_url` automatically on every page load (only on Settings visit)
- Showing participant chips outside the expanded detail panel
- Changes to Debts page participant display
