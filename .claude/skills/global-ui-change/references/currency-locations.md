---
name: Currency Reference Locations
description: Complete map of every currency reference in the BudgetMate codebase
---

# Currency Reference Locations

Complete map of every place currency is referenced, formatted, or displayed. Update this file after any currency change.

Last verified: 2026-03-17

---

## Hardcoded Symbol: `₪` (Shekel)

| File | Lines | Context |
|------|-------|---------|
| `src/pages/Budget.jsx` | ~520, 528, 541, 609, 612 | Budget totals, remaining, over-budget display |
| `src/components/ui/ExpenseCard.jsx` | ~55 | Expense amount in list cards |
| `src/components/stats/MonthlyBarChart.jsx` | ~20, 43 | Y-axis tick formatter, tooltip |
| `src/pages/Debts.tsx` | ~69 | Debt amount display |
| `src/components/i18n/translations.jsx` | ~71, 244, 354, 488, 527 | Currency symbol inside translation strings |

**To change symbol:** Replace literal `₪` with the new symbol in all rows above.
**To make dynamic:** Replace `₪{amount}` with a `fmt(amount)` call using Pattern 1 below.

---

## Dynamic Currency via Intl.NumberFormat (Pattern 1)

| File | Line | Current Default | Notes |
|------|------|-----------------|-------|
| `src/pages/Dashboard.jsx` | ~95 | `'USD'` | Inconsistent with other pages |
| `src/pages/Goals.jsx` | ~191-197 | `'ILS'` | `maximumFractionDigits: 0` |
| `src/pages/Profile.jsx` | ~100-106 | `'ILS'` | `maximumFractionDigits: 0` |

**Pattern:**
```js
const currency = settings?.currency || 'ILS';
const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
```

**To change default:** Update the fallback string in `|| 'ILS'` (or `|| 'USD'`) to match the desired default currency code.

**Note:** `Dashboard.jsx` currently defaults to `'USD'` while others default to `'ILS'`. This is a known inconsistency — align them when making a currency change.

---

## toLocaleString (Pattern 2 — legacy)

| File | Lines | Current Locale |
|------|-------|----------------|
| `src/pages/Budget.jsx` | multiple | `'en-US'` |

**Pattern:**
```js
amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```

These do NOT include a currency symbol — the `₪` is prepended as a hardcoded string. Both the symbol and locale string may need updating.

---

## Currency in User Settings (Database)

- Entity: `UserSettings` via `base44.entities.UserSettings`
- Field: `settings.currency` — an ISO 4217 currency code (e.g. `'USD'`, `'ILS'`, `'EUR'`)
- Access pattern:
  ```js
  const { data: settings } = useQuery({
    queryKey: ['settings', user?.email],
    queryFn: async () => {
      const list = await base44.entities.UserSettings.filter({ user_email: user.email });
      return list[0] || null;
    },
  });
  const currency = settings?.currency || 'ILS';
  ```

---

## Summary: Files to Touch for a Full Currency Change

For a complete currency change (e.g., ₪ → $, ILS → USD):

1. `src/components/i18n/translations.jsx` — update symbol strings at lines ~71, 244, 354, 488, 527
2. `src/pages/Budget.jsx` — replace `₪` symbols + `toLocaleString('en-US', ...)` defaults
3. `src/components/ui/ExpenseCard.jsx` — replace `₪` in amount display
4. `src/components/stats/MonthlyBarChart.jsx` — replace `₪` in tickFormatter
5. `src/pages/Debts.tsx` — replace `₪` in amount display
6. `src/pages/Dashboard.jsx` — change default from `'USD'` to new currency code
7. `src/pages/Goals.jsx` — change default from `'ILS'` to new currency code
8. `src/pages/Profile.jsx` — change default from `'ILS'` to new currency code
