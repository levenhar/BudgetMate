# Multi-Currency Expense Entry — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to record any expense (regular, recurring, or shared) in a foreign currency (ILS/USD/EUR), with live exchange rate conversion and a badge in the expense list showing the original currency.

**Architecture:** Three nullable columns are added to `expenses`, `recurring_expenses`, and `shared_expenses` tables in Supabase. A small `fetchExchangeRate` utility calls frankfurter.app at entry time. The `UnifiedExpenseDialog` and `EditExpenseDialog` grow a currency selector + rate info line; `ExpenseCard` shows a badge and expanded detail row for foreign-currency expenses.

**Tech Stack:** React 18, Supabase (direct SQL migration via MCP), Tailwind CSS + Shadcn/UI Select, Lucide React icons, Sonner toasts.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/api/exchangeRate.js` | **Create** | `fetchExchangeRate(from, to)` — single exported function |
| `src/components/i18n/translations.jsx` | **Modify** | Add 7 new keys to all language objects |
| `src/components/ui/UnifiedExpenseDialog.jsx` | **Modify** | Currency selector + rate state machine on all 3 tabs |
| `src/components/ui/EditExpenseDialog.jsx` | **Modify** | Currency pre-fill + live rate fetch on open |
| `src/components/ui/ExpenseCard.jsx` | **Modify** | Foreign currency badge (row) + detail row (expanded) |
| Supabase DB (via MCP) | **Migrate** | 3 nullable columns × 3 tables |

---

## Task 1: Database Migration

**Files:** Supabase DB (via `mcp__supabase__apply_migration`)

- [ ] **Step 1: Apply the migration**

Use the Supabase MCP tool `mcp__supabase__apply_migration` with the following SQL. Name it `add_multi_currency_columns`.

```sql
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS original_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS exchange_rate     NUMERIC;

ALTER TABLE recurring_expenses
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS original_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS exchange_rate     NUMERIC;

ALTER TABLE shared_expenses
  ADD COLUMN IF NOT EXISTS original_currency TEXT,
  ADD COLUMN IF NOT EXISTS original_amount   NUMERIC,
  ADD COLUMN IF NOT EXISTS exchange_rate     NUMERIC;
```

- [ ] **Step 2: Verify columns exist**

Run via `mcp__supabase__execute_sql`:
```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name IN ('expenses','recurring_expenses','shared_expenses')
  AND column_name IN ('original_currency','original_amount','exchange_rate')
ORDER BY table_name, column_name;
```
Expected: 9 rows (3 columns × 3 tables).

- [ ] **Step 3: Commit**
```bash
git add -A
git commit -m "feat: add multi-currency columns to expense tables"
```

---

## Task 2: Exchange Rate Service

**Files:**
- Create: `src/api/exchangeRate.js`

- [ ] **Step 1: Create the file**

```js
// src/api/exchangeRate.js

/**
 * Fetches the exchange rate: how many units of `toCurrency` equals 1 unit of `fromCurrency`.
 * Returns 1 immediately when currencies are the same (no network call).
 * Throws an Error if the network request fails or the API response is invalid.
 *
 * @param {string} fromCurrency - e.g. 'USD'
 * @param {string} toCurrency   - e.g. 'ILS'
 * @returns {Promise<number>}
 */
export async function fetchExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return 1;

  const url = `https://api.frankfurter.app/latest?from=${fromCurrency}&to=${toCurrency}`;
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Exchange rate fetch failed: ${res.status}`);
  }

  const data = await res.json();
  const rate = data?.rates?.[toCurrency];

  if (typeof rate !== 'number' || rate <= 0) {
    throw new Error(`Invalid exchange rate received for ${fromCurrency}→${toCurrency}`);
  }

  return rate;
}
```

- [ ] **Step 2: Smoke-test in browser console (manual)**

Open the app in the browser dev tools and run:
```js
import('/src/api/exchangeRate.js').then(m => m.fetchExchangeRate('USD','ILS')).then(console.log)
```
Expected: a positive number like `3.71`.

- [ ] **Step 3: Commit**
```bash
git add src/api/exchangeRate.js
git commit -m "feat: add fetchExchangeRate utility (frankfurter.app)"
```

---

## Task 3: i18n Translation Keys

**Files:**
- Modify: `src/components/i18n/translations.jsx`

The file has two language objects: `he` (Hebrew, RTL) and `en` (English, LTR). Add the same 7 keys to **both** objects.

- [ ] **Step 1: Add keys to the `he` object**

Find the `// Settings` section inside the `he` object (around line 44) and add after the existing currency keys:

```js
// Multi-currency
currency_label: 'מטבע',
original_amount_label: 'מקורי',
currency_rate_info: '1 {from} = {rate} {toSymbol}  ·  סה"כ: {totalSymbol}{total}',
currency_rate_info_edit: 'נוכחי: 1 {from} = {rate} {toSymbol}  (היה {storedRate} בעת הזנה)',
currency_rate_loading: 'טוען שער חליפין...',
currency_rate_error: 'לא ניתן לטעון שער חליפין',
currency_rate_retry: 'נסה שוב',
```

- [ ] **Step 2: Add keys to the `en` object**

Find the equivalent section in the `en` object and add:

```js
// Multi-currency
currency_label: 'Currency',
original_amount_label: 'Original',
currency_rate_info: '1 {from} = {rate} {toSymbol}  ·  Total: {totalSymbol}{total}',
currency_rate_info_edit: 'Current: 1 {from} = {rate} {toSymbol}  (was {storedRate} at entry)',
currency_rate_loading: 'Fetching exchange rate...',
currency_rate_error: 'Could not fetch exchange rate',
currency_rate_retry: 'Retry',
```

- [ ] **Step 3: Build to verify no syntax errors**
```bash
npm run build
```
Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**
```bash
git add src/components/i18n/translations.jsx
git commit -m "feat: add multi-currency i18n keys (he + en)"
```

---

## Task 4: UnifiedExpenseDialog — Currency Selector & Rate UI

**Files:**
- Modify: `src/components/ui/UnifiedExpenseDialog.jsx`

This is the largest change. Work through it methodically.

- [ ] **Step 1: Add the `fetchExchangeRate` import at the top of the file**

After the existing imports, add:
```js
import { fetchExchangeRate } from '@/api/exchangeRate';
```

- [ ] **Step 2: Add `SUPPORTED_CURRENCIES` constant**

After the imports, before the component function, add:
```js
const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'];
```

- [ ] **Step 3: Add a shared `useCurrencyRate` hook inline in the file**

Before the `UnifiedExpenseDialog` function definition, add this helper hook:
```js
/**
 * Manages the exchange rate state machine for a single form tab.
 * Returns { rateStatus, exchangeRate, selectCurrency, retryFetch, resetRate }
 */
function useCurrencyRate(defaultCurrency) {
  const [selectedCurrency, setSelectedCurrency] = React.useState(defaultCurrency);
  const [rateStatus, setRateStatus] = React.useState('idle'); // 'idle'|'loading'|'ready'|'error'
  const [exchangeRate, setExchangeRate] = React.useState(null);

  const doFetch = React.useCallback(async (from, to, errorMsg) => {
    setRateStatus('loading');
    setExchangeRate(null);
    try {
      const rate = await fetchExchangeRate(from, to);
      setExchangeRate(rate);
      setRateStatus('ready');
    } catch {
      setRateStatus('error');
      if (errorMsg) toast.error(errorMsg);
    }
  }, []);

  const selectCurrency = React.useCallback((currency, defaultCurr, errorMsg) => {
    setSelectedCurrency(currency);
    if (currency === defaultCurr) {
      setRateStatus('idle');
      setExchangeRate(null);
    } else {
      doFetch(currency, defaultCurr, errorMsg);
    }
  }, [doFetch]);

  const retryFetch = React.useCallback((defaultCurr, errorMsg) => {
    doFetch(selectedCurrency, defaultCurr, errorMsg);
  }, [doFetch, selectedCurrency]);

  const resetRate = React.useCallback((defaultCurr) => {
    setSelectedCurrency(defaultCurr);
    setRateStatus('idle');
    setExchangeRate(null);
  }, []);

  return { selectedCurrency, rateStatus, exchangeRate, selectCurrency, retryFetch, resetRate };
}
```

- [ ] **Step 4: Add a `CurrencyRateInfo` helper component**

After `useCurrencyRate`, add:
```js
/**
 * Renders the rate info line, spinner, or error+retry below the amount field.
 */
function CurrencyRateInfo({ rateStatus, exchangeRate, fromCurrency, toCurrency, toSymbol, amount, t, onRetry }) {
  if (rateStatus === 'idle') return null;

  if (rateStatus === 'loading') {
    return (
      <p className="text-xs text-slate-400 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        {t.currency_rate_loading}
      </p>
    );
  }

  if (rateStatus === 'error') {
    return (
      <p className="text-xs text-red-500 flex items-center gap-1">
        {t.currency_rate_error}
        <button type="button" onClick={onRetry} className="underline ml-1">
          {t.currency_rate_retry}
        </button>
      </p>
    );
  }

  // ready
  const total = amount && exchangeRate ? (parseFloat(amount) * exchangeRate).toFixed(2) : '—';
  const info = t.currency_rate_info
    .replace('{from}', fromCurrency)
    .replace('{rate}', exchangeRate?.toFixed(4) ?? '')
    .replace('{toSymbol}', toSymbol)
    .replace('{totalSymbol}', toSymbol)
    .replace('{total}', total);

  return <p className="text-xs text-slate-500">{info}</p>;
}
```

- [ ] **Step 5: Wire up rate hooks for each tab**

Inside `UnifiedExpenseDialog`, destructure `currencyCode` from `useCurrency()` (it already imports `useCurrency`):
```js
const { currencySymbol, currencyCode } = useCurrency();
```

Then add three rate hook calls (one per tab) right after the existing state declarations:
```js
const expenseRate  = useCurrencyRate(currencyCode);
const recurringRate = useCurrencyRate(currencyCode);
const sharedRate   = useCurrencyRate(currencyCode);
```

Also update `resetExpenseForm`, `resetRecurringForm`, `resetSharedForm` to reset the rate:
```js
const resetExpenseForm = () => {
  setExpenseForm({ amount: '', date: new Date(), categoryId: '', description: '', merchant: '', paymentMethod: '', installments: 1, showMore: false });
  expenseRate.resetRate(currencyCode);
};
const resetRecurringForm = () => {
  setRecurringForm({ name: '', amount: '', category_id: '', frequency: 'monthly', start_date: new Date(), end_date: null, description: '', is_active: true });
  recurringRate.resetRate(currencyCode);
};
const resetSharedForm = () => {
  setSharedForm({ amount: '', date: new Date(), categoryId: '', description: '', paidByUserId: '', splitMethod: 'equal', participants: [], splits: [] });
  setUserSearch('');
  setSearchResults([]);
  sharedRate.resetRate(currencyCode);
};
```

- [ ] **Step 6: Add currency selector UI to the regular expense tab**

In the regular expense tab, find the amount `<Input>` row (inside `<div className="flex gap-3">`). After the `<Input>`, add the currency selector:

```jsx
<Select
  value={expenseRate.selectedCurrency}
  onValueChange={(v) => expenseRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
>
  <SelectTrigger className="w-20 h-14 text-xs">
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {SUPPORTED_CURRENCIES.map(c => (
      <SelectItem key={c} value={c}>{c}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

Below the amount row (after `</div>` closing the flex row), add the rate info line:
```jsx
<CurrencyRateInfo
  rateStatus={expenseRate.rateStatus}
  exchangeRate={expenseRate.exchangeRate}
  fromCurrency={expenseRate.selectedCurrency}
  toCurrency={currencyCode}
  toSymbol={currencySymbol}
  amount={expenseForm.amount}
  t={t}
  onRetry={() => expenseRate.retryFetch(currencyCode, t.currency_rate_error)}
/>
```

- [ ] **Step 7: Update `handleSubmitExpense` to include currency fields**

Replace the `onSubmitExpense({...})` call payload:
```js
const isForeign = expenseRate.selectedCurrency !== currencyCode;
const originalAmount = parseFloat(expenseForm.amount);
const convertedAmount = isForeign ? originalAmount * expenseRate.exchangeRate : originalAmount;

await onSubmitExpense({
  amount: convertedAmount,
  date: format(expenseForm.date, 'yyyy-MM-dd'),
  category_id: expenseForm.categoryId,
  category_name: category?.name || '',
  description: expenseForm.description || undefined,
  merchant: expenseForm.merchant || undefined,
  payment_method: expenseForm.paymentMethod || undefined,
  installments: expenseForm.installments,
  ...(isForeign && {
    original_currency: expenseRate.selectedCurrency,
    original_amount: originalAmount,
    exchange_rate: expenseRate.exchangeRate,
  }),
});
```

Also disable the submit button when rate is loading or errored:
```jsx
disabled={
  !expenseForm.amount || !expenseForm.categoryId || isSubmittingExpense ||
  expenseRate.rateStatus === 'loading' || expenseRate.rateStatus === 'error'
}
```

- [ ] **Step 8: Add currency selector + rate info to recurring tab**

Find the `<Input>` for amount in the recurring tab (inside the `grid grid-cols-2 gap-3`). Change that cell to be `flex gap-2` containing the amount input + currency selector:

Replace:
```jsx
<div className="space-y-2">
  <Label className="text-start block">{t.amount_label}</Label>
  <Input
    type="number"
    step="0.01"
    value={recurringForm.amount}
    onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
    className={`text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
    dir="ltr"
    required
  />
</div>
```

With:
```jsx
<div className="space-y-2 col-span-2">
  <Label className="text-start block">{t.amount_label}</Label>
  <div className="flex gap-2">
    <Input
      type="number"
      step="0.01"
      value={recurringForm.amount}
      onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })}
      className={`flex-1 text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
      dir="ltr"
      required
    />
    <Select
      value={recurringRate.selectedCurrency}
      onValueChange={(v) => recurringRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
    >
      <SelectTrigger className="w-20 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map(c => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  <CurrencyRateInfo
    rateStatus={recurringRate.rateStatus}
    exchangeRate={recurringRate.exchangeRate}
    fromCurrency={recurringRate.selectedCurrency}
    toCurrency={currencyCode}
    toSymbol={currencySymbol}
    amount={recurringForm.amount}
    t={t}
    onRetry={() => recurringRate.retryFetch(currencyCode, t.currency_rate_error)}
  />
</div>
```

Note: the amount cell now spans 2 columns (`col-span-2`) so frequency drops to a new row. Adjust the grid wrapper: change `grid grid-cols-2 gap-3` to `grid grid-cols-2 gap-3` and let the frequency select remain in its own `<div className="space-y-2">` (it will now be on the second row, left column).

- [ ] **Step 9: Update `handleSubmitRecurring` payload**

```js
const isForeign = recurringRate.selectedCurrency !== currencyCode;
const originalAmount = parseFloat(recurringForm.amount);
const convertedAmount = isForeign ? originalAmount * recurringRate.exchangeRate : originalAmount;

await onSubmitRecurring({
  name: recurringForm.name,
  amount: convertedAmount,
  category_id: recurringForm.category_id,
  category_name: category?.name || '',
  frequency: recurringForm.frequency,
  start_date: format(recurringForm.start_date, 'yyyy-MM-dd'),
  end_date: recurringForm.end_date ? format(recurringForm.end_date, 'yyyy-MM-dd') : null,
  description: recurringForm.description || undefined,
  is_active: recurringForm.is_active,
  ...(isForeign && {
    original_currency: recurringRate.selectedCurrency,
    original_amount: originalAmount,
    exchange_rate: recurringRate.exchangeRate,
  }),
});
```

Disable submit when rate is loading/error:
```jsx
disabled={
  !recurringForm.name || !recurringForm.amount || !recurringForm.category_id ||
  isSubmittingRecurring ||
  recurringRate.rateStatus === 'loading' || recurringRate.rateStatus === 'error'
}
```

- [ ] **Step 10: Add currency selector + rate info to shared expense tab**

In the shared tab, find the `total_amount` `<Input>` inside the `grid grid-cols-2 gap-3`. Change its cell to `col-span-2` and add the currency selector inline:

Replace:
```jsx
<div className="space-y-2">
  <Label className="text-start block">{t.total_amount_label}</Label>
  <Input
    type="number"
    step="0.01"
    value={sharedForm.amount}
    onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
    className={`text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
    dir="ltr"
    required
  />
</div>
```

With:
```jsx
<div className="space-y-2 col-span-2">
  <Label className="text-start block">{t.total_amount_label}</Label>
  <div className="flex gap-2">
    <Input
      type="number"
      step="0.01"
      value={sharedForm.amount}
      onChange={(e) => setSharedForm({ ...sharedForm, amount: e.target.value })}
      className={`flex-1 text-lg font-semibold ${dir === 'rtl' ? 'text-right' : ''}`}
      dir="ltr"
      required
    />
    <Select
      value={sharedRate.selectedCurrency}
      onValueChange={(v) => sharedRate.selectCurrency(v, currencyCode, t.currency_rate_error)}
    >
      <SelectTrigger className="w-20 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map(c => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  <CurrencyRateInfo
    rateStatus={sharedRate.rateStatus}
    exchangeRate={sharedRate.exchangeRate}
    fromCurrency={sharedRate.selectedCurrency}
    toCurrency={currencyCode}
    toSymbol={currencySymbol}
    amount={sharedForm.amount}
    t={t}
    onRetry={() => sharedRate.retryFetch(currencyCode, t.currency_rate_error)}
  />
</div>
```

- [ ] **Step 11: Update `handleSubmitShared` payload**

Inside `handleSubmitShared`, before the `await onSubmitShared(...)` call, compute:
```js
const isForeign = sharedRate.selectedCurrency !== currencyCode;
const originalAmount = totalAmount; // totalAmount is already computed above
const convertedTotal = isForeign ? originalAmount * sharedRate.exchangeRate : originalAmount;
```

Then pass `total_amount: convertedTotal` (instead of `totalAmount`) and add:
```js
...(isForeign && {
  original_currency: sharedRate.selectedCurrency,
  original_amount: originalAmount,
  exchange_rate: sharedRate.exchangeRate,
}),
```

Disable submit when rate is loading/error:
```jsx
disabled={
  isSubmittingShared || sharedForm.participants.length === 0 ||
  sharedRate.rateStatus === 'loading' || sharedRate.rateStatus === 'error'
}
```

- [ ] **Step 12: Build and visually verify**
```bash
npm run build
npm run dev
```
Open the add-expense dialog. Switch each tab, change currency to USD, confirm the info line appears showing the rate. Confirm the form submits and the expense appears in the list.

- [ ] **Step 13: Commit**
```bash
git add src/components/ui/UnifiedExpenseDialog.jsx
git commit -m "feat: add currency selector and live rate to expense add form (all 3 tabs)"
```

---

## Task 5: EditExpenseDialog — Currency Pre-fill & Live Rate

**Files:**
- Modify: `src/components/ui/EditExpenseDialog.jsx`

- [ ] **Step 1: Add imports**

```js
import { fetchExchangeRate } from '@/api/exchangeRate';
import { useCurrency } from '@/lib/CurrencyContext';
import { Loader2 } from "lucide-react"; // already imported, verify
```

- [ ] **Step 2: Add constants and hook call inside the component**

At the top of the `EditExpenseDialog` component body, add:
```js
const { currencyCode, currencySymbol } = useCurrency();
const SUPPORTED_CURRENCIES = ['ILS', 'USD', 'EUR'];

const [selectedCurrency, setSelectedCurrency] = React.useState(currencyCode);
const [rateStatus, setRateStatus] = React.useState('idle');
const [exchangeRate, setExchangeRate] = React.useState(null);
```

- [ ] **Step 3: Extend `formData` state to include `original_amount`**

In the `useState` initializer:
```js
const [formData, setFormData] = useState({
  amount: '',       // shown in the input — original_amount if foreign, amount otherwise
  date: new Date(),
  category_id: '',
  description: '',
  merchant: '',
  payment_method: '',
});
```

In the `useEffect` that populates form from `expense`, update to:
```js
useEffect(() => {
  if (expense) {
    const isForeign = expense.original_currency && expense.original_currency !== currencyCode;
    setFormData({
      amount: isForeign
        ? (expense.original_amount?.toString() || '')
        : (expense.amount?.toString() || ''),
      date: expense.date ? parseISO(expense.date) : new Date(),
      category_id: expense.category_id || '',
      description: expense.description || '',
      merchant: expense.merchant || '',
      payment_method: expense.payment_method || '',
    });
    const initialCurrency = expense.original_currency || currencyCode;
    setSelectedCurrency(initialCurrency);
    if (isForeign) {
      // Trigger live rate fetch
      setRateStatus('loading');
      setExchangeRate(null);
      fetchExchangeRate(initialCurrency, currencyCode)
        .then(rate => { setExchangeRate(rate); setRateStatus('ready'); })
        .catch(() => setRateStatus('error'));
    } else {
      setRateStatus('idle');
      setExchangeRate(null);
    }
  }
}, [expense, currencyCode]);
```

- [ ] **Step 4: Add `handleCurrencyChange` function**

```js
const handleCurrencyChange = (currency) => {
  setSelectedCurrency(currency);
  if (currency === currencyCode) {
    setRateStatus('idle');
    setExchangeRate(null);
  } else {
    setRateStatus('loading');
    setExchangeRate(null);
    fetchExchangeRate(currency, currencyCode)
      .then(rate => { setExchangeRate(rate); setRateStatus('ready'); })
      .catch(() => setRateStatus('error'));
  }
};

const retryFetch = () => {
  setRateStatus('loading');
  fetchExchangeRate(selectedCurrency, currencyCode)
    .then(rate => { setExchangeRate(rate); setRateStatus('ready'); })
    .catch(() => setRateStatus('error'));
};
```

- [ ] **Step 5: Update `handleSave`**

```js
const handleSave = async () => {
  const category = categories.find(c => c.id === formData.category_id);
  const isForeign = selectedCurrency !== currencyCode;
  const originalAmount = parseFloat(formData.amount);
  const convertedAmount = isForeign ? originalAmount * exchangeRate : originalAmount;

  await onSave({
    ...expense,
    amount: convertedAmount,
    date: format(formData.date, 'yyyy-MM-dd'),
    category_id: formData.category_id,
    category_name: category?.name || '',
    description: formData.description || undefined,
    merchant: formData.merchant || undefined,
    payment_method: formData.payment_method || undefined,
    ...(isForeign
      ? { original_currency: selectedCurrency, original_amount: originalAmount, exchange_rate: exchangeRate }
      : { original_currency: null, original_amount: null, exchange_rate: null }
    ),
  });
};
```

- [ ] **Step 6: Update the Amount field UI**

Replace the existing amount `<div className="space-y-2">` block with:
```jsx
<div className="space-y-2">
  <Label>{t.amount}</Label>
  <div className="flex gap-2">
    <Input
      type="number"
      step="0.01"
      value={formData.amount}
      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
      className="flex-1 text-lg font-semibold"
    />
    <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
      <SelectTrigger className="w-20 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SUPPORTED_CURRENCIES.map(c => (
          <SelectItem key={c} value={c}>{c}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>

  {/* Rate info line */}
  {rateStatus === 'loading' && (
    <p className="text-xs text-slate-400 flex items-center gap-1">
      <Loader2 className="h-3 w-3 animate-spin" />
      {t.currency_rate_loading}
    </p>
  )}
  {rateStatus === 'error' && (
    <p className="text-xs text-red-500">
      {t.currency_rate_error}
      <button type="button" onClick={retryFetch} className="underline ml-1">
        {t.currency_rate_retry}
      </button>
    </p>
  )}
  {rateStatus === 'ready' && exchangeRate && (
    <p className="text-xs text-slate-500">
      {t.currency_rate_info_edit
        .replace('{from}', selectedCurrency)
        .replace('{rate}', exchangeRate.toFixed(4))
        .replace('{toSymbol}', currencySymbol)
        .replace('{storedRate}', expense?.exchange_rate?.toFixed(4) ?? '—')}
    </p>
  )}
</div>
```

- [ ] **Step 7: Disable save button when rate is loading/error**

```jsx
disabled={
  !formData.amount || !formData.category_id || isLoading ||
  rateStatus === 'loading' || rateStatus === 'error'
}
```

- [ ] **Step 8: Build and test**
```bash
npm run build
npm run dev
```
Open the expenses list, edit a foreign-currency expense (add one first via the add dialog if needed). Confirm the dialog pre-fills the original amount and currency, shows the live rate, and saves correctly.

- [ ] **Step 9: Commit**
```bash
git add src/components/ui/EditExpenseDialog.jsx
git commit -m "feat: add currency selector and live rate to edit expense dialog"
```

---

## Task 6: ExpenseCard — Foreign Currency Badge & Detail Row

**Files:**
- Modify: `src/components/ui/ExpenseCard.jsx`

- [ ] **Step 1: Add `CURRENCY_SYMBOLS` import**

At the top of `ExpenseCard.jsx`, add:
```js
import { CURRENCY_SYMBOLS } from '@/lib/CurrencyContext';
```

(This constant is already exported from `CurrencyContext.jsx`.)

- [ ] **Step 2: Add the foreign currency badge to the row**

In the row section, find this block (around line 76):
```jsx
<span className="font-semibold text-slate-900 whitespace-nowrap">
  {currencySymbol}{expense.amount.toFixed(2)}
</span>
```

Replace with:
```jsx
<span className="font-semibold text-slate-900 whitespace-nowrap">
  {currencySymbol}{expense.amount.toFixed(2)}
</span>
{expense.original_currency && (
  <>
    <span className="text-slate-300">·</span>
    <span className="text-slate-400 text-xs whitespace-nowrap truncate max-w-[80px]">
      {CURRENCY_SYMBOLS[expense.original_currency] || expense.original_currency}
      {expense.original_amount?.toFixed(2)} {expense.original_currency}
    </span>
  </>
)}
```

- [ ] **Step 3: Add the original currency row to the expanded detail panel**

In the expanded panel (`{isExpanded && (...)}` block), find the `{/* Amount */}` detail row (around line 158):
```jsx
{/* Amount */}
<div className="flex items-center gap-2">
  <Wallet className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
  <span className="text-slate-500">{t.amount || 'Amount'}:</span>
  <span className="font-semibold text-slate-800">{currencySymbol}{expense.amount.toFixed(2)}</span>
</div>
```

After this block, add:
```jsx
{/* Original currency */}
{expense.original_currency && (
  <div className="flex items-center gap-2">
    <ArrowRightLeft className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
    <span className="text-slate-500">{t.original_amount_label || 'Original'}:</span>
    <span className="font-medium text-slate-700">
      {CURRENCY_SYMBOLS[expense.original_currency] || expense.original_currency}
      {expense.original_amount?.toFixed(2)} {expense.original_currency}
      {expense.exchange_rate && (
        <span className="text-slate-400 ml-1">· rate: {expense.exchange_rate.toFixed(4)}</span>
      )}
    </span>
  </div>
)}
```

`ArrowRightLeft` is already imported in this file.

- [ ] **Step 4: Build and visually verify**
```bash
npm run build
npm run dev
```
Add a USD expense, go to the expenses list. Confirm:
- The row shows `₪185.50 · $50.00 USD` (example values)
- Expanding the card shows an "Original" row with the rate

- [ ] **Step 5: Commit**
```bash
git add src/components/ui/ExpenseCard.jsx
git commit -m "feat: show foreign currency badge and detail row in ExpenseCard"
```

---

## Task 7: Final Build & Smoke Test

- [ ] **Step 1: Run full build**
```bash
npm run build
```
Expected: no errors, no TypeScript errors.

- [ ] **Step 2: Run lint**
```bash
npm run lint
```
Expected: no new errors.

- [ ] **Step 3: End-to-end smoke test (manual)**

With `npm run dev`:

1. Open add expense dialog → regular tab → change currency to USD → type amount `50` → confirm info line shows rate and converted total → submit → verify expense appears with badge `· $50.00 USD`
2. Expand the expense card → verify "Original" row shows `$50.00 USD · rate: X.XXXX`
3. Click edit on the expense → verify original amount `50` and currency `USD` pre-fill → verify live rate loads → change amount → save → verify updated correctly
4. Open add expense → recurring tab → change to EUR → verify rate info line → submit
5. Open add expense → shared tab → change to USD → verify rate info line → submit

- [ ] **Step 4: Final commit**
```bash
git add -A
git commit -m "feat: multi-currency expense entry — complete implementation"
```
