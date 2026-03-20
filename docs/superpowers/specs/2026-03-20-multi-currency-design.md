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
- Default value initialised from `currencyCode` via `useCurrency()` — each tab's form state includes a `currency` field, initialised to `currencyCode` on mount.
- On all 3 tabs: the currency selector sits **to the right of the amount input** in the same flex row (amount takes `flex-1`, selector is fixed-width ~80px). This means on recurring tab the amount + currency selector span one row, and the frequency select drops to the second column of the grid as before.
- Mobile: badge text truncates with `truncate` if the row is too narrow; the full value is visible in the expanded detail panel.

### Form state machine for rate loading

Each tab tracks: `{ rateStatus: 'idle' | 'loading' | 'error' | 'ready', exchangeRate: number | null }`.

| Event | Transition |
|---|---|
| User selects default currency | → `idle`, info line hidden, original fields cleared |
| User selects foreign currency | → `loading`, spinner shown |
| Fetch succeeds | → `ready`, rate stored, info line shown |
| Fetch fails | → `error`, toast shown, submit disabled |
| User re-selects same foreign currency | re-fetch (re-enter `loading`) |

Submit button is disabled when `rateStatus === 'loading'` or `rateStatus === 'error'`.

### Same-currency path
- No network call, no extra UI, behavior identical to today.

### Foreign-currency path
1. User selects a different currency → rate fetch begins immediately.
2. While fetching: small spinner below the amount field.
3. On success: info line shown — `"1 USD = 3.71 ₪  ·  Total: ₪185.50"` (updates live as amount changes using the cached `exchangeRate`).
4. On failure: Sonner toast error; submit button disabled until user retries (re-selects currency to re-fetch).

### Submit payload additions
When currency differs from default:
- `original_currency`: the selected currency code
- `original_amount`: the raw number the user typed
- `exchange_rate`: the fetched rate
- `amount`: `original_amount × exchange_rate` (converted)

When same as default: `original_currency`, `original_amount`, `exchange_rate` are **omitted** from the payload entirely (not set to null) — no change from current behavior.

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

- Pre-fills `currency` selector with `original_currency` (or default currency if null), and `amount` field with `original_amount` (or `amount` if null).
- On dialog open: if `original_currency` is set and differs from default, immediately trigger a rate fetch (same state machine as the add form: `loading → ready | error`).
- Info line shows the fresh rate alongside a note of the stored rate: `"Current: 1 USD = 3.75 ₪  (was 3.71 at entry)"`.
- On save: if foreign currency, `amount = original_amount × fresh_rate`; all 3 fields updated. If user switched back to default currency, `original_currency`, `original_amount`, `exchange_rate` are set to `null` in the update payload.
- If rate fetch fails on open: submit is disabled; a small inline "Retry" link appears in the info line area (same location as the spinner/info line). Clicking it re-triggers the fetch.

### Frankfurter API response validation
`fetchExchangeRate` must validate: `response.rates[toCurrency]` exists and is a positive number. If missing or invalid, treat as fetch failure (throw).

---

## 6. Error Handling

| Scenario | Behaviour |
|---|---|
| Rate fetch fails (network) | Sonner toast, submit disabled, retry by re-selecting currency |
| frankfurter returns missing/invalid rate | Treated as fetch failure — same as above |
| User edits amount after rate loaded | Info line recalculates immediately client-side (no re-fetch) |
| User switches currency back to default | Info line hidden, `rateStatus → idle`, original fields omitted from payload |
| Edit dialog: rate fetch fails on open | Submit disabled, inline retry button shown |
| Edit dialog: user clears foreign currency | `original_currency/amount/exchange_rate` set to null on save |

---

## 7. i18n

New translation keys to add to `translations.jsx` for all supported languages:

| Key | Example (EN) |
|---|---|
| `currency_rate_info` | `"1 {from} = {rate} {toSymbol}  ·  Total: {totalSymbol}{total}"` |
| `currency_rate_info_edit` | `"Current: 1 {from} = {rate} {toSymbol}  (was {storedRate} at entry)"` |
| `currency_rate_loading` | `"Fetching exchange rate..."` |
| `currency_rate_error` | `"Could not fetch exchange rate"` |
| `currency_rate_retry` | `"Retry"` |
| `currency_label` | `"Currency"` |
| `original_amount_label` | `"Original"` |

The info line is built with string interpolation (same pattern as other translated strings in the app). In RTL layout, the `·` separator and symbol positions should follow the surrounding text direction automatically.

---

## 8. Out of Scope

- Shared expense split amounts in foreign currency: when a shared expense is entered in a foreign currency, the converted `amount` (in default currency) is what gets split among participants. Example: $50 USD = ₪185.50; each of 2 people owes ₪92.75. The original $50 USD is recorded on the shared expense record for display purposes only.
- Historical rate lookup by expense date (always uses live rate at time of entry/edit)
- More than 3 currencies (ILS, USD, EUR only)
- Per-user currency favorites
- Session-level caching of exchange rates (each currency selection triggers a fresh fetch)
