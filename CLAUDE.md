# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Lint with ESLint
npm run lint:fix     # Auto-fix lint issues
npm run typecheck    # TypeScript type checking
npm run preview      # Preview production build
```

**E2E tests** use Playwright (headed mode, slow motion 500ms, Chrome):
```bash
npx playwright test
npx playwright test <test-file>
```

**Environment setup**: Copy `.env.example` to `.env.local` and fill in Supabase credentials:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Workflow
When creating a plan for complex features, implement the changes in the same session rather than ending at the planning stage. If the task is too large, implement the most critical piece and note remaining work.

**Start with the smallest working piece** — do not produce a full plan and wait for approval. Write code, apply changes, verify build, then iterate.

## Build & Test 
This is a TypeScript project. Always run `npm run build` and `npm run test` after making changes. All tests must pass before considering a task complete.


## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite, TypeScript support, React Router DOM v6
- **Styling**: Tailwind CSS + Shadcn/UI (new-york style) + Radix UI primitives
- **State**: TanStack React Query (server state), React Hook Form + Zod (forms)
- **Backend**: Supabase (PostgreSQL + Auth)
- **Animation**: Framer Motion

### Project Structure

```
src/
├── api/
│   ├── supabaseClient.js     # Supabase client init
│   └── base44Client.js       # ORM-like proxy over Supabase (primary data access layer)
├── pages/                    # One file per route, auto-registered via pages.config.js
├── components/
│   ├── ui/                   # Shadcn/UI + custom UI primitives
│   ├── stats/                # Chart components (Recharts-based)
│   └── i18n/                 # LanguageContext (multi-language + RTL)
├── lib/
│   ├── AuthContext.jsx        # Supabase auth state (wrap all routes)
│   ├── query-client.js        # React Query client config
│   └── utils.js               # cn() helper (clsx + tailwind-merge)
├── Layout.jsx                 # App shell: sidebar, mobile nav, add-expense dialog
└── App.jsx                    # Router setup
```

### Data Access Pattern

All entity CRUD goes through `base44Client` — never query Supabase directly unless you need auth or storage operations:

```js
import { base44 } from "@/api/base44Client";

// CRUD
base44.entities.Expense.list()
base44.entities.Expense.filter({ category: "food" })
base44.entities.Expense.create({ amount: 50, ... })  // auto-injects created_by
base44.entities.Expense.update(id, patch)
base44.entities.Expense.delete(id)
base44.entities.Expense.bulkCreate([...])
```

Entities: `Expense`, `Category`, `Budget`, `SavingsGoal`, `Debt`, `RecurringExpense`, `SharedExpense`, `Household`, `Notification`, `UserProfile`, `Settings`.

### Routing

Routes are auto-generated from `pages.config.js`. Each file in `src/pages/` maps to a route. The `Layout.jsx` wraps all authenticated pages and provides the sidebar + mobile bottom nav.

### Key Patterns

- **Imports**: Always use `@/` alias (e.g., `@/components/ui/button`, `@/lib/AuthContext`)
- **Auth**: Access via `useAuth()` from `@/lib/AuthContext`
- **Forms**: React Hook Form + Zod resolver
- **Toasts**: Sonner (`sonner` package) — preferred over `react-hot-toast`
- **Icons**: Lucide React
- **Charts**: Recharts (see `src/components/stats/`)
- **Date handling**: date-fns (preferred) or moment.js

### Domain Knowledge

**SharedExpense / Debt Dependency**
The Debts page derives all balances from `SharedExpense` records. Never delete a `SharedExpense` record without understanding its downstream effect on `Debts.tsx`. Reverse-debt records exist intentionally to balance the ledger — do not remove them.

**Falsy Value Pitfalls**
When checking optional numeric/string values, use explicit checks — not loose falsy:
- ✅ `if (value === undefined)` / `if (value === null)`
- ❌ `if (!value)` — will incorrectly treat `0` and `""` as missing

### Household Mode

The app supports two modes: personal and household (shared finances). `Settings.household_mode` toggles this. Shared expenses have an approval workflow — expenses must be accepted before they're counted.
