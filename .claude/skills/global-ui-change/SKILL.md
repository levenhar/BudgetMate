---
name: global-ui-change
description: This skill should be used when the user asks to "translate the app", "change the currency", "change dollar to shekel", "change all text", "update currency symbol everywhere", "add a new language", "change language", "replace all occurrences of X with Y across the UI", "change the default currency", or any similarly scoped task that requires making the same change consistently across many files in BudgetMate.
version: 0.1.0
---

# Global UI Change Skill

For sweeping, consistent UI changes that repeat across many files in BudgetMate — like currency swaps, language additions, or text replacements. The guiding principle is **zero missed occurrences** — find every instance before changing any of them.

## Two Categories of Global Change

### Category A: Currency Changes

Changing the displayed currency (e.g., $ → ₪, USD → ILS) touches **two distinct layers**:

1. **Hardcoded symbols** — literal `₪`, `$`, `€` characters in JSX/TSX
2. **Intl.NumberFormat / toLocaleString** — currency code defaults (`'USD'`, `'ILS'`)

Both must be updated. Missing either layer leaves inconsistency.

### Category B: Text / Translation Changes

Adding a new language or updating all UI text touches:

1. **`src/components/i18n/translations.jsx`** — the single source of truth for all translated strings (570+ lines, 150+ keys)
2. **`src/components/i18n/LanguageContext.jsx`** — supported language list and default language
3. **Hardcoded strings** not yet wired through the translation system (a few still exist — see references)

---

## Workflow

### Step 1: Search Before Touching Anything

Run ALL search queries first. Do not edit a single file until the full list of occurrences is known.

**For currency changes**, search for:
```
₪          (hardcoded shekel symbol)
$          (hardcoded dollar symbol — filter out CSS $ vars)
€          (hardcoded euro)
USD        (currency code string)
ILS        (currency code string)
currency   (variable references)
toLocaleString
Intl.NumberFormat
```

**For text/translation changes**, search for:
```
useLanguage    (all files that consume translations)
translations.he  /  translations.en   (inside translations.jsx)
hardcoded Hebrew strings (search Hebrew Unicode range: \p{Script=Hebrew} or grep for specific strings)
```

Use Grep with `output_mode: "files_with_matches"` first to get the file list, then `output_mode: "content"` with context to see exact lines.

### Step 2: Build a Complete Hit-List

Before making any edit, write out every file and line that needs to change. A typical currency change will hit:

| File | What to change |
|------|---------------|
| `src/components/i18n/translations.jsx` | Currency symbol strings in translation keys |
| `src/pages/Budget.jsx` | Hardcoded `₪` + `toLocaleString` defaults |
| `src/components/ui/ExpenseCard.jsx` | Hardcoded `₪` symbol |
| `src/components/stats/MonthlyBarChart.jsx` | `tickFormatter` symbol |
| `src/pages/Debts.tsx` | Hardcoded `₪` symbol |
| `src/pages/Dashboard.jsx` | `settings?.currency \|\| 'USD'` default |
| `src/pages/Goals.jsx` | `settings?.currency \|\| 'ILS'` default |
| `src/pages/Profile.jsx` | `settings?.currency \|\| 'ILS'` default |

A typical language addition will hit:

| File | What to change |
|------|---------------|
| `src/components/i18n/translations.jsx` | Add new language object with all 150+ keys |
| `src/components/i18n/LanguageContext.jsx` | Add to `supportedLanguages` array |

### Step 3: Make Changes File by File

Work through the hit-list top to bottom. For each file:
- Read the relevant lines first
- Make the targeted edit
- Do not touch unrelated code in the same file

### Step 4: Verify with a Re-Scan

After all edits, re-run the original search queries to confirm zero remaining occurrences of the old value.

### Step 5: Build

```bash
npm run build
```

Fix only build errors — do not reorganize code.

---

## BudgetMate-Specific Rules

### Currency Architecture

The app has **two currency patterns** — both must be updated for a full currency change:

**Pattern 1 — Dynamic (preferred, via user settings):**
```js
const currency = settings?.currency || 'USD';   // ← change default here
const fmt = (n) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
```
Files: `Dashboard.jsx`, `Goals.jsx`, `Profile.jsx`

**Pattern 2 — Hardcoded symbol (legacy, needs replacing):**
```jsx
<span>₪{expense.amount.toFixed(2)}</span>   // ← change or refactor to use fmt()
```
Files: `ExpenseCard.jsx`, `Budget.jsx`, `Debts.tsx`, `MonthlyBarChart.jsx`, `translations.jsx`

When changing currency, update both patterns. If the task is only to change the symbol display, updating the hardcoded symbols is sufficient. If the task is to make currency user-configurable, migrate Pattern 2 files to use `fmt()` via the settings-driven approach.

### Translation Architecture

All translations live in **one file**: `src/components/i18n/translations.jsx`

Structure:
```js
export const translations = {
  he: { direction: 'rtl', dashboard: 'לוח בקרה', ... },  // 150+ keys
  en: { direction: 'ltr', dashboard: 'Dashboard', ... },
};

export const supportedLanguages = [
  { code: 'he', label: 'עברית' },
  { code: 'en', label: 'English' },
];
```

To add a language:
1. Add a new key to `translations` with all the same keys as `he` and `en` — never leave a key missing or the UI will show `undefined`
2. Add to `supportedLanguages` array in the same file
3. Set `direction: 'rtl'` for Arabic/Hebrew, `direction: 'ltr'` for all others

### Hardcoded Strings Not in Translations

A few strings bypass the translation system entirely. Consult `references/hardcoded-strings.md` for the current list. These must be migrated to `translations.jsx` before a full translation is complete.

### Default Language

Set in `src/components/i18n/LanguageContext.jsx`:
```js
const [lang, setLangState] = useState(() => {
  return localStorage.getItem('app_language') || 'he';  // ← change default here
});
```

---

## Common Mistakes to Avoid

- **Editing before searching** — always build the full hit-list first
- **Missing `translations.jsx`** — currency symbols appear there too (in formatted amount strings)
- **Only updating hardcoded symbols** — forgetting `Intl.NumberFormat` defaults leaves wrong currency in some pages
- **Inconsistent defaults** — `Dashboard.jsx` defaults to `'USD'` while `Goals.jsx` defaults to `'ILS'`; after a change they must all agree
- **Adding a language without all keys** — translations.jsx has 150+ keys; a missing key renders as `undefined` in the UI
- **Forgetting RTL/LTR direction** — every translation object must have a `direction` field

---

## Additional Resources

- **`references/hardcoded-strings.md`** — list of strings not yet wired through translations.jsx, and where they live
- **`references/currency-locations.md`** — complete map of every currency reference in the codebase
