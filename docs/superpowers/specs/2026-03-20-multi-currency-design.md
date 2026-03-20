# Multi-Currency Expense Entry — Design Spec

**Date:** 2026-03-20
**Status:** Approved

## Overview

Allow users to record any expense (regular, recurring, or shared) in a foreign currency. The app fetches the live exchange rate at entry time, stores both the original and converted amounts, and displays a foreign-currency badge on the expense list.

---

## Scope

- All three expense types: regular, recurring, shared
- Supported currencies: ILS, USD, EUR (the existing app currencies)
- Exchange rate source: `frankfurter.app` (free, no API key, ECB data)
- Rate fetch strategy: live fetch at time of entry (not cached)

---

## 1. Database

Three tables receive 3 new **nullable** columns each:

```sql
ALTER TABLE expenses            ADD COLUMN original_currency TEXT;
ALTER TABLE expenses            ADD COLUMN original_amount   NUMERIC;
ALTER TABLE expenses            ADD COLUMN exchange_rate     NUMERIC;

ALTER TABLE recurring_expenses  ADD COLUMN original_currency TEXT;
ALTER TABLE recurring_expenses  ADD COLUMN original_amount   NUMERIC;
ALTER TABLE recurring_expenses  ADD COLUMN exchange_rate     NUMERIC;

ALTER TABLE shared_expenses     ADD COLUMN original_currency TEXT;
ALTER TABLE shared_expenses     ADD COLUMN original_amount   NUMERIC;
ALTER TABLE shared_expenses     ADD COLUMN exchange_rate     NUMERIC;
```

**Invariants:**
- `amount` (existing column) always holds the converted value in the user's default currency.
- `original_currency` is `NULL` for same-currency expenses — no UI change for those rows.
- `exchange_rate` is frozen at entry time for auditability.
- All columns are nullable; existing rows are untouched.

---

## 2. Exchange Rate Service

**File:** `src/api/exchangeRate.js`

Single exported function:

```js
fetchExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>
```

- Returns `1` immediately if `fromCurrency === toCurrency`.
- Calls `https://api.frankfurter.app/latest?from={from}&to={to}`.
- Parses `response.rates[toCurrency]`.
- Throws on network error or unexpected response — callers handle the error with a toast.

---

## 3. Form UI — UnifiedExpenseDialog

### Currency Selector
- Compact `Select` (ILS / USD / EUR) placed inline next to the amount input on all 3 tabs.
- Default value = user's default currency from `CurrencyContext`.

### Same-currency path
- No network call, no extra UI, behavior identical to today.

### Foreign-currency path
1. User selects a different currency → rate fetch begins immediately.
2. While fetching: small spinner below the amount field.
3. On success: info line shown — `"1 USD = 3.71 ₪  ·  Total: ₪185.50"` (updates live as amount changes).
4. On failure: Sonner toast error; submit button disabled until a valid rate is available.

### Submit payload additions
When currency differs from default:
- `original_currency`: the selected currency code
- `original_amount`: the raw number the user typed
- `exchange_rate`: the fetched rate
- `amount`: `original_amount × exchange_rate` (converted)

When same as default: fields omitted (no change from current behavior).

---

## 4. Expense List — ExpenseCard

### Row badge (always visible)
- When `expense.original_currency` is set, show inline after the converted amount:
  `₪185.50 · $50 USD`
- Badge style: muted (`text-slate-400 text-xs`), separated by a `·` divider.
- No badge for same-currency expenses.

### Expanded detail panel
- New detail row: **"Original"** — `$50.00 USD  ·  rate: 3.71`
- Rendered only when `expense.original_currency` is set.
- Positioned next to the existing Amount row in the 2-column grid.

---

## 5. Edit Expense Dialog

- Pre-fills `original_currency` and `original_amount` from the stored record.
- Re-fetches live rate on dialog open (shows current rate, not the stored one).
- On save: recalculates `amount = original_amount × fresh_rate`; updates all 3 fields.

---

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| Rate fetch fails (network) | Sonner toast, submit disabled |
| frankfurter returns unexpected shape | Same as above |
| User edits amount after rate loaded | Info line recalculates immediately client-side |
| User switches currency back to default | Info line hidden, original fields cleared |

---

## 7. Out of Scope

- Shared expense split amounts in foreign currency (splits always use the converted default-currency amount)
- Historical rate lookup by expense date
- More than 3 currencies
- Per-user currency favorites
