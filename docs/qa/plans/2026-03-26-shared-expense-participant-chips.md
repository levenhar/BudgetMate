# Shared Expense Participant Avatar Chips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a row of avatar chips (Google photo + initials fallback) for all participants of a shared expense in its expanded detail panel on the Expenses page.

**Architecture:** Store `picture_url` in `UserProfile` (populated on login via `Setting.jsx`). Fetch all profiles in `Expenses.jsx` to build a `email → {name, picture_url}` map, then refactor `splitParticipantsMap` to carry full participant objects. Pass an array of participants down to `ExpenseCard` which renders chips using Shadcn `Avatar` + `Tooltip`.

**Tech Stack:** React 18, TanStack React Query, Supabase (SQL migration), Shadcn/UI Avatar + Tooltip, Tailwind CSS, Playwright E2E

---

## File Map

| File | Change |
|---|---|
| Supabase SQL | Add `picture_url` column to `user_profiles` |
| `src/pages/Setting.jsx` | Write `picture_url` to `UserProfile` on login/visit |
| `src/pages/Expenses.jsx` | Add `userProfiles` query, `userProfileMap`, refactor `splitParticipantsMap`, fix `sharedWithUser` filter + `sharedUsers` memo, pass `sharedParticipants` to `<ExpenseCard>` |
| `src/components/ui/ExpenseCard.jsx` | Add `getInitials` helper, `sharedParticipants` prop, replace "Shared info" row with avatar chips |
| `qa/specs/shared-expense-chips.spec.js` | E2E test: expand shared expense, verify chips |

---

## Task 1: Supabase Migration — add `picture_url` to `user_profiles`

**Files:**
- Modify: Supabase dashboard → SQL Editor

- [ ] **Step 1: Run SQL migration**

Open the Supabase dashboard for this project → SQL Editor → run:

```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS picture_url TEXT;
```

- [ ] **Step 2: Verify column exists**

In the Supabase Table Editor, open `user_profiles` and confirm `picture_url` appears as a nullable text column.

- [ ] **Step 3: Commit migration note**

```bash
git commit --allow-empty -m "chore: add picture_url column to user_profiles (applied in Supabase)"
```

---

## Task 2: Write Failing E2E Test

**Files:**
- Create: `qa/specs/shared-expense-chips.spec.js`

- [ ] **Step 1: Write the test**

```js
// qa/specs/shared-expense-chips.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';

const BASE = 'http://localhost:5173';

test.describe('Shared expense participant chips', () => {
  test.setTimeout(60000);

  test('expanding a shared expense shows participant chips with names', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    await page.waitForTimeout(1500);

    // Find the first shared expense row (has the shared badge icon area)
    // Shared rows have a Users/Send/Clock icon badge between the pipes
    const sharedRow = page
      .locator('.rounded-lg')
      .filter({ has: page.locator('svg').filter({ hasText: '' }) })
      .first();

    // More reliable: find a row that is NOT pending (blue/amber) and IS shared (green Users badge)
    // Click any shared expense row to expand it
    const rows = page.locator('.group.flex.items-center');
    const count = await rows.count();
    let expanded = false;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      // Look for the Users SVG icon (shared expense badge)
      const hasSharedBadge = await row.locator('.bg-green-50.border-green-200, .bg-blue-50.border-blue-200, .bg-blue-50\\/40').count();
      if (hasSharedBadge > 0) {
        await row.click();
        await page.waitForTimeout(600);
        expanded = true;
        break;
      }
    }

    if (!expanded) {
      test.skip(); // No shared expenses available for this user — skip
      return;
    }

    // After expanding, the detail panel should contain "Shared with:" label
    const sharedWithLabel = page.locator('text=/shared with/i').first();
    await expect(sharedWithLabel).toBeVisible({ timeout: 3000 });

    // At least one avatar chip should be visible (rounded-full pill with a name)
    const chips = page.locator('.rounded-full').filter({ hasText: /.+/ });
    await expect(chips.first()).toBeVisible({ timeout: 3000 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx playwright test qa/specs/shared-expense-chips.spec.js --headed
```

Expected: FAIL — "Shared with:" label not found (feature not yet implemented).

---

## Task 3: `Setting.jsx` — Persist `picture_url` on Login

**Files:**
- Modify: `src/pages/Setting.jsx` lines 65–84

- [ ] **Step 1: Read current upsert code**

Open `src/pages/Setting.jsx` lines 65–84. Current code:

```js
useQuery({
  queryKey: ['userProfile', user?.email],
  queryFn: async () => {
    const existing = await base44.entities.UserProfile.filter({ user_email: user.email });
    if (existing.length === 0) {
      await base44.entities.UserProfile.create({
        user_email: user.email,
        full_name: user.full_name || '',
        status: 'active',
      });
    } else if (existing[0].full_name !== user.full_name) {
      await base44.entities.UserProfile.update(existing[0].id, {
        full_name: user.full_name || '',
      });
    }
    return true;
  },
  enabled: !!user?.email,
});
```

- [ ] **Step 2: Replace with picture_url-aware upsert**

Replace the entire `useQuery` block above with:

```js
useQuery({
  queryKey: ['userProfile', user?.email],
  queryFn: async () => {
    const existing = await base44.entities.UserProfile.filter({ user_email: user.email });
    const pictureUrl = user.picture || null;
    if (existing.length === 0) {
      await base44.entities.UserProfile.create({
        user_email: user.email,
        full_name: user.full_name || '',
        picture_url: pictureUrl,
        status: 'active',
      });
    } else if (existing[0].full_name !== user.full_name || existing[0].picture_url !== pictureUrl) {
      await base44.entities.UserProfile.update(existing[0].id, {
        full_name: user.full_name || '',
        picture_url: pictureUrl,
      });
    }
    return true;
  },
  enabled: !!user?.email,
});
```

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Setting.jsx
git commit -m "feat: persist picture_url to UserProfile on login"
```

---

## Task 4: `Expenses.jsx` — Refactor Data Layer

**Files:**
- Modify: `src/pages/Expenses.jsx`

### Step group A — Add `userProfiles` query and `userProfileMap`

- [ ] **Step 1: Add `userProfiles` query**

After the `splits` query (around line 139), add:

```js
// Fetch user profiles to get picture_url for participant chips
const { data: userProfiles = [] } = useQuery({
  queryKey: ['userProfiles'],
  queryFn: () => base44.entities.UserProfile.list(),
  enabled: !!user?.email,
});
```

- [ ] **Step 2: Add `userProfileMap` derived memo**

After the `sharedExpenseStatusMap` memo (around line 148), add:

```js
// Map email → { name, picture_url } for participant chip rendering
const userProfileMap = useMemo(() =>
  new Map(userProfiles.map(p => [p.user_email, {
    name: p.full_name || p.user_email,
    picture_url: p.picture_url || null,
  }])),
  [userProfiles]
);
```

### Step group B — Refactor `splitParticipantsMap`

- [ ] **Step 3: Replace `splitParticipantsMap` (lines ~161–176)**

Replace the entire `splitParticipantsMap` useMemo with:

```js
// Map each shared_expense_id to an array of full participant objects.
// Only includes shared expenses the current user participates in.
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
      map.set(split.shared_expense_id, []);
    }
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

### Step group C — Fix `sharedWithUser` filter

- [ ] **Step 4: Fix `participants?.has(selectedUser)` (line ~819)**

Find:
```js
return participants?.has(selectedUser) ?? false;
```

Replace with:
```js
return participants?.some(p => p.email === selectedUser) ?? false;
```

### Step group D — Fix `sharedUsers` memo

- [ ] **Step 5: Replace `sharedUsers` memo (lines ~864–876)**

Replace the entire `sharedUsers` useMemo with:

```js
// Build dropdown options from splitParticipantsMap — all co-participants except self.
const sharedUsers = useMemo(() => {
  const userMap = new Map();
  for (const [, participants] of splitParticipantsMap) {
    for (const p of participants) {
      if (p.email === user?.email) continue;
      if (!userMap.has(p.email)) {
        userMap.set(p.email, { email: p.email, name: p.name });
      }
    }
  }
  return Array.from(userMap.values());
}, [splitParticipantsMap, user?.email]);
```

- [ ] **Step 6: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "feat: add userProfileMap and refactor splitParticipantsMap with participant details"
```

---

## Task 5: `ExpenseCard.jsx` — Avatar Chips UI

**Files:**
- Modify: `src/components/ui/ExpenseCard.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/ui/ExpenseCard.jsx`, after the existing imports, add:

```js
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
```

- [ ] **Step 2: Add `getInitials` helper**

After the `paymentMethodLabels` object (around line 23), add:

```js
function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 3: Add `sharedParticipants` to props**

Change the component signature from:

```js
export default function ExpenseCard({ expense, categoryColor, onEdit, onDelete, onApprovePending, currentUserEmail, sharedExpensePendingUsers, isExpanded, onToggleExpand }) {
```

to:

```js
export default function ExpenseCard({ expense, categoryColor, onEdit, onDelete, onApprovePending, currentUserEmail, sharedExpensePendingUsers, isExpanded, onToggleExpand, sharedParticipants = [] }) {
```

- [ ] **Step 4: Replace the "Shared info" row in the expanded panel**

Find (lines ~224–236):

```jsx
{/* Shared info */}
{expense.is_shared && (
  <div className="flex items-center gap-2 col-span-2">
    <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
    <span className="text-slate-500">{t.shared || 'Shared'}:</span>
    {expense.paid_by_user_id && expense.paid_by_user_id !== currentUserEmail && (
      <span className="text-slate-600">{t.paid_by || 'Paid by'} {expense.paid_by_user_id}</span>
    )}
    {(!expense.paid_by_user_id || expense.paid_by_user_id === currentUserEmail) && (
      <span className="text-slate-600">{t.paid_by_you || 'Paid by you'}</span>
    )}
  </div>
)}
```

Replace with:

```jsx
{/* Shared participants */}
{expense.is_shared && sharedParticipants.length > 0 && (
  <div className="flex items-start gap-2 col-span-2">
    <Users className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
    <span className="text-slate-500 flex-shrink-0">{t.shared_with || 'Shared with'}:</span>
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-wrap gap-1">
        {sharedParticipants.map(p => {
          const isMe = p.email === currentUserEmail;
          const label = isMe ? (t.you || 'You') : p.name;
          const initials = getInitials(label);
          return (
            <Tooltip key={p.email}>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 bg-slate-100 rounded-full px-1.5 py-0.5 cursor-default">
                  <Avatar className="w-4 h-4">
                    <AvatarImage src={p.picture_url || undefined} />
                    <AvatarFallback className="text-[8px] bg-slate-300">{initials}</AvatarFallback>
                  </Avatar>
                  <span className="text-xs text-slate-600 leading-none">{label}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top">
                {isMe ? p.email : `${p.name} · ${p.email}`}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  </div>
)}
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/ExpenseCard.jsx
git commit -m "feat: add participant avatar chips to shared expense detail panel"
```

---

## Task 6: Wire `sharedParticipants` Prop in `Expenses.jsx`

**Files:**
- Modify: `src/pages/Expenses.jsx` (~line 1066)

- [ ] **Step 1: Pass `sharedParticipants` to `<ExpenseCard>`**

Find the `<ExpenseCard` usage (~line 1066). It currently ends with `onDelete={...}`. Add this prop before the closing `/>`:

```jsx
sharedParticipants={
  expense.source_shared_expense_id
    ? (splitParticipantsMap.get(expense.source_shared_expense_id) ?? [])
    : []
}
```

The full block should look like:

```jsx
<ExpenseCard
  key={expense.id}
  expense={expense}
  categoryColor={cat?.color || '#64748b'}
  currentUserEmail={user?.email}
  isExpanded={expandedId === expense.id}
  onToggleExpand={(id) => setExpandedId(prev => prev === id ? null : id)}
  onApprovePending={expense.is_pending && expense.is_shared && expense.created_by !== user?.email
    ? (e) => setPendingApprovalExpense(e)
    : undefined}
  sharedParticipants={
    expense.source_shared_expense_id
      ? (splitParticipantsMap.get(expense.source_shared_expense_id) ?? [])
      : []
  }
  onEdit={async (e) => {
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Expenses.jsx
git commit -m "feat: wire sharedParticipants prop to ExpenseCard"
```

---

## Task 7: Run E2E Test and Verify

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Leave it running in a terminal.

- [ ] **Step 2: Run the Playwright test**

```bash
npx playwright test qa/specs/shared-expense-chips.spec.js --headed
```

Expected: PASS — "Shared with:" label and at least one chip visible after expanding a shared expense.

- [ ] **Step 3: If FAIL — debug**

Take a screenshot mid-test by adding `await page.screenshot({ path: 'debug-chips.png' })` after the expand click, then inspect what rendered. Common issues:
- No shared expenses in test user's data → create one manually via the UI first
- `splitParticipantsMap` not populated → check that `splits` query returns data

- [ ] **Step 4: Commit test**

```bash
git add qa/specs/shared-expense-chips.spec.js
git commit -m "test: add E2E for shared expense participant chips"
```

---

## Task 8: Full Build + Lint Check

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any if present.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.
