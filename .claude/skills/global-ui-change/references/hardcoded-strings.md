---
name: Hardcoded Strings Not in Translations
description: Strings that bypass the translation system and are hardcoded directly in component files
---

# Hardcoded Strings Not in translations.jsx

These strings are NOT routed through the `useLanguage()` / `t.*` system. A full translation of the app requires migrating these into `translations.jsx` first.

## Current List (as of 2026-03-17)

### `src/pages/Setting.jsx`

| Line | String | Language | Migration Key Suggestion |
|------|--------|----------|--------------------------|
| ~137 | `'הקטגוריה נוספה בהצלחה!'` | Hebrew | `t.category_added_success` |
| ~146 | `'הקטגוריה עודכנה בהצלחה!'` | Hebrew | `t.category_updated_success` |

These are toast messages passed directly to `toast.success(...)`. They need to use `t.*` after the translation key is added.

**Fix pattern:**
```js
// Before
toast.success('הקטגוריה נוספה בהצלחה!');

// After
const { t } = useLanguage();
toast.success(t.category_added_success);
```

---

### `src/components/stats/MonthlyBarChart.jsx`

| Line | String | Language | Migration Key Suggestion |
|------|--------|----------|--------------------------|
| ~9 | `'אין נתונים זמינים'` | Hebrew | `t.no_data_available` |

This is an empty-state label rendered directly in JSX. The component does not currently use `useLanguage()`.

**Fix pattern:**
```jsx
// Before (no useLanguage import)
<div className="...">אין נתונים זמינים</div>

// After
import { useLanguage } from "@/components/i18n/LanguageContext";
const { t } = useLanguage();
<div className="...">{t.no_data_available}</div>
```

---

## How to Migrate a Hardcoded String

1. Pick or create a translation key name (snake_case)
2. Add the key to **both** `translations.he` and `translations.en` in `src/components/i18n/translations.jsx`
3. Import and destructure `useLanguage()` in the component if not already present
4. Replace the hardcoded string with `t.your_key`
5. Re-run `npm run build` to confirm no regressions

## Notes

- `src/Layout.jsx` line ~308 uses `user?.full_name || 'BudgetMate'` — the fallback `'BudgetMate'` is intentional (brand name, not translatable)
- All other pages use `useLanguage()` correctly via the `t.*` pattern
