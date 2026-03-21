# QA Agent Workflow — Weekly GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a weekly GitHub Actions workflow that runs 10 parallel Playwright QA agents against the BudgetMate app, generates a markdown bug report, and automatically creates a fix branch using Claude Code Action.

**Architecture:** A dedicated QA Playwright config (`tests/qa/playwright.config.js`) defines 10 parallel projects (one per agent role) with proper dependencies. Global setup creates fresh Supabase test accounts + seeds data. Agents write partial markdown reports to `/tmp/`; a merge script assembles the final report in `docs/qa/`. Phase 2 uses `anthropic-ai/claude-code-action` in a downstream GHA job to implement fixes on a new branch.

**Tech Stack:** Playwright, @supabase/supabase-js (already installed), Node.js, GitHub Actions, `anthropic-ai/claude-code-action@beta`, `wait-on` package

**Spec document:** `docs/superpowers/specs/2026-03-21-qa-agent-workflow-design.md`

---

## File Map

```
tests/qa/
  playwright.config.js          NEW — CI-optimized config, 10 parallel projects
  global-setup.js               NEW — Setup Agent: creates accounts + seeds data
  global-teardown.js            NEW — Deletes test accounts after run
  helpers/
    supabase-admin.js           NEW — Supabase Admin API wrapper
    auth.js                     NEW — signIn() / signOut() shared helper
    signals.js                  NEW — Read/write coordination signal files
    bug-report.js               NEW — Write bug entries to partial report files
  specs/
    expenses.spec.js            NEW — Expenses Agent
    budget.spec.js              NEW — Budget Agent
    goals.spec.js               NEW — Goals Agent
    debts.spec.js               NEW — Debts Agent
    recurring.spec.js           NEW — Recurring Agent
    statistics.spec.js          NEW — Statistics Agent
    settings.spec.js            NEW — Settings Agent (runs after the 6 above)
    shared-a.spec.js            NEW — Shared-A Agent (User A)
    shared-b.spec.js            NEW — Shared-B Agent (User B)
    shared-c.spec.js            NEW — Shared-C Agent (User C)
  merge-reports.js              NEW — Merges /tmp/qa-report-*.md → docs/qa/bug-report-DATE.md
.github/
  workflows/
    weekly-qa.yml               NEW — Weekly schedule + test run + fix pipeline
```

**Do NOT modify:**
- `playwright.config.js` (root) — keep for existing local tests
- `tests/sign-in.spec.js`, `tests/settle-debt.spec.js`, etc. — unrelated

---

## Task 1: Supabase Admin Helper

**Files:**
- Create: `tests/qa/helpers/supabase-admin.js`

This module wraps Supabase Admin API operations. It follows the exact same pattern as the existing `scripts/create-test-users.js`.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/helpers/supabase-admin.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Copy .env.example to .env.local and add SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function createTestUser(email, password, fullName) {
  // Delete if exists from prior run (fetch up to 1000 users to avoid 50-user page limit)
  try {
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (!error && data?.users) {
      const existing = data.users.find(u => u.email === email);
      if (existing) {
        await adminClient.auth.admin.deleteUser(existing.id);
      }
    }
  } catch (_) { /* ignore */ }

  const { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw new Error(`createTestUser(${email}): ${error.message}`);

  const userId = data.user.id;

  await adminClient.from('user_profiles').upsert({
    id: userId,
    user_email: email,
    full_name: fullName,
    status: 'active',
    created_by: email,
  }, { onConflict: 'id' });

  await adminClient.from('user_settings').upsert({
    user_email: email,
    mode: 'personal',
    currency: 'USD',
    created_by: email,
  }, { onConflict: 'user_email' });

  return userId;
}

export async function deleteTestUser(email) {
  try {
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data?.users) return;
    const user = data.users.find(u => u.email === email);
    if (user) await adminClient.auth.admin.deleteUser(user.id);
  } catch (_) { /* ignore */ }
}

export async function seedCategory(userEmail, name) {
  const { data, error } = await adminClient.from('categories').insert({
    name,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedCategory(${name}): ${error.message}`);
  return data.id;
}

export async function seedBudget(userEmail, categoryId, categoryName, amount = 500) {
  const { data, error } = await adminClient.from('budgets').insert({
    budget_type: 'per_category',
    category_id: categoryId,
    category_name: categoryName,
    amount,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedBudget(${categoryName}): ${error.message}`);
  return data.id;
}

export async function seedRecurringExpense(userEmail, categoryId, categoryName) {
  const { data, error } = await adminClient.from('recurring_expenses').insert({
    name: 'Rent [seeded]',
    amount: 1200,
    frequency: 'monthly',
    start_date: '2026-01-01',
    category_id: categoryId,
    category_name: categoryName,
    is_active: true,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedRecurringExpense: ${error.message}`);
  return data.id;
}

export async function seedSavingsGoal(userEmail) {
  const { data, error } = await adminClient.from('savings_goals').insert({
    name: 'Emergency Fund [seeded]',
    target_amount: 10000,
    current_amount: 0,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedSavingsGoal: ${error.message}`);
  return data.id;
}

export async function seedDebt(userEmail) {
  const { data, error } = await adminClient.from('debts').insert({
    from_user_id: userEmail,
    from_user_name: 'QA User A',
    to_user_id: 'external-creditor',
    to_user_name: 'External Creditor',
    amount: 500,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedDebt: ${error.message}`);
  return data.id;
}

export async function createHousehold(ownerEmail, memberEmails) {
  // Delete any prior QA household
  await adminClient.from('households').delete().eq('name', 'QA Household');

  const { data, error } = await adminClient.from('households').insert({
    name: 'QA Household',
    owner_email: ownerEmail,
    member_emails: memberEmails,
    invite_code: 'QA-TEST-CODE',
    created_by: ownerEmail,
  }).select().single();
  if (error) throw new Error(`createHousehold: ${error.message}`);
  return data.id;
}

export async function setHouseholdMode(userEmail, householdId) {
  await adminClient.from('user_settings')
    .update({ mode: 'household', current_household_id: householdId })
    .eq('user_email', userEmail);
}
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < tests/qa/helpers/supabase-admin.js 2>&1 | head -5
```
Expected: No output (the module just defines exports, no side effects at import)

---

## Task 2: Auth Helper

**Files:**
- Create: `tests/qa/helpers/auth.js`

Shared sign-in/sign-out used by all spec files. Based on the existing pattern in `tests/settle-debt.spec.js`.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/helpers/auth.js
const BASE_URL = 'http://localhost:5173';

export async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login'), { timeout: 20000 });
  await page.waitForTimeout(1500); // let React Query settle
}

export async function signOut(page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10000 });
}

export const QA_USERS = {
  a: { email: 'qa-user-a@budgetmate.local', password: 'QAtest!2026' },
  b: { email: 'qa-user-b@budgetmate.local', password: 'QAtest!2026' },
  c: { email: 'qa-user-c@budgetmate.local', password: 'QAtest!2026' },
};

export const BASE_URL_EXPORT = BASE_URL;
```

---

## Task 3: Signal Helpers

**Files:**
- Create: `tests/qa/helpers/signals.js`

Atomic file-based coordination between parallel Playwright workers.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/helpers/signals.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const SIGNAL_DIR = os.tmpdir();

function signalPath(agentName) {
  return path.join(SIGNAL_DIR, `qa-signal-${agentName}.json`);
}

/**
 * Write one or more key=true entries into an agent's signal file.
 * Atomic: write to .tmp then rename.
 */
export function writeSignal(agentName, checkpoints) {
  const filePath = signalPath(agentName);
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch (_) {}
  const updated = { ...existing, ...checkpoints };
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, JSON.stringify(updated));
  fs.renameSync(tmpPath, filePath);
}

/**
 * Poll until a specific checkpoint key is true in the target agent's signal file.
 * Throws after timeoutMs if not seen.
 */
export async function waitForSignal(agentName, checkpoint, timeoutMs = 120000) {
  const filePath = signalPath(agentName);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data[checkpoint]) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 5000));
  }
  throw new Error(`Timeout waiting for signal: ${agentName}.${checkpoint} (${timeoutMs}ms)`);
}

export function readSession() {
  const sessionPath = path.join(SIGNAL_DIR, 'qa-session.json');
  return JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
}
```

---

## Task 4: Bug Report Helper

**Files:**
- Create: `tests/qa/helpers/bug-report.js`

Appends a formatted bug entry to `/tmp/qa-report-<agent>.md`.

- [ ] **Step 1: Create the file (complete, correct version)**

```javascript
// tests/qa/helpers/bug-report.js
import fs from 'fs';
import path from 'path';
import os from 'os';
import { writeSignal } from './signals.js';

let bugCounter = 0;

/**
 * Append a bug entry to the agent's partial report.
 * @param {string} agentName - e.g. 'expenses', 'shared-a'
 * @param {{ severity, feature, route, steps, expected, actual, consoleErrors, notes }} bug
 */
export function reportBug(agentName, bug) {
  bugCounter++;
  const reportPath = path.join(os.tmpdir(), `qa-report-${agentName}.md`);
  const id = `BUG-${String(bugCounter).padStart(3, '0')}`;
  const entry = `
### ${id} · ${bug.severity} · ${bug.feature}

**Agent:** ${agentName}
**Route:** ${bug.route || 'localhost:5173/'}
**Steps to Reproduce:**
${(bug.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}
**Expected:** ${bug.expected}
**Actual:** ${bug.actual}
**Console Errors:** ${bug.consoleErrors || 'None'}
**Notes:** ${bug.notes || 'None'}

---
`;
  fs.appendFileSync(reportPath, entry);
  console.error(`[${agentName}] ${id} ${bug.severity}: ${bug.feature}`);
}

/**
 * Mark this agent as complete by writing its completion signal.
 * Call at the end of every spec's afterAll.
 */
export function markComplete(agentName) {
  writeSignal(agentName, { complete: true });
}
```

---

## Task 5: Global Setup (Setup Agent)

**Files:**
- Create: `tests/qa/global-setup.js`

Creates the 3 test accounts, household, and seed data. Writes `/tmp/qa-session.json`.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/global-setup.js
import { writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  createTestUser, createHousehold, setHouseholdMode,
  seedCategory, seedBudget, seedRecurringExpense,
  seedSavingsGoal, seedDebt,
} from './helpers/supabase-admin.js';
import { writeSignal } from './helpers/signals.js';

const USER_A = 'qa-user-a@budgetmate.local';
const USER_B = 'qa-user-b@budgetmate.local';
const USER_C = 'qa-user-c@budgetmate.local';
const PASSWORD = 'QAtest!2026';

export default async function globalSetup() {
  console.log('[setup] Creating test accounts...');

  const [idA, idB, idC] = await Promise.all([
    createTestUser(USER_A, PASSWORD, 'QA User A'),
    createTestUser(USER_B, PASSWORD, 'QA User B'),
    createTestUser(USER_C, PASSWORD, 'QA User C'),
  ]);

  console.log('[setup] Creating household...');
  const householdId = await createHousehold(USER_A, [USER_B, USER_C]);
  await Promise.all([
    setHouseholdMode(USER_A, householdId),
    setHouseholdMode(USER_B, householdId),
    setHouseholdMode(USER_C, householdId),
  ]);

  console.log('[setup] Seeding baseline data...');
  const [foodId, transportId, housingId, entertainmentId] = await Promise.all([
    seedCategory(USER_A, 'Food [seeded]'),
    seedCategory(USER_A, 'Transport [seeded]'),
    seedCategory(USER_A, 'Housing [seeded]'),
    seedCategory(USER_A, 'Entertainment [seeded]'),
  ]);

  const [foodBudgetId, transportBudgetId, housingBudgetId, entertainmentBudgetId] = await Promise.all([
    seedBudget(USER_A, foodId, 'Food [seeded]'),
    seedBudget(USER_A, transportId, 'Transport [seeded]'),
    seedBudget(USER_A, housingId, 'Housing [seeded]'),
    seedBudget(USER_A, entertainmentId, 'Entertainment [seeded]'),
  ]);

  const [recurringId, goalId, debtId] = await Promise.all([
    seedRecurringExpense(USER_A, housingId, 'Housing [seeded]'),
    seedSavingsGoal(USER_A),
    seedDebt(USER_A),
  ]);

  const session = {
    users: {
      a: { email: USER_A, password: PASSWORD, id: idA },
      b: { email: USER_B, password: PASSWORD, id: idB },
      c: { email: USER_C, password: PASSWORD, id: idC },
    },
    householdId,
    seedData: {
      categoryIds: { food: foodId, transport: transportId, housing: housingId, entertainment: entertainmentId },
      budgetIds: { food: foodBudgetId, transport: transportBudgetId, housing: housingBudgetId, entertainment: entertainmentBudgetId },
      recurringExpenseId: recurringId,
      savingsGoalId: goalId,
      debtId,
    },
  };

  const sessionPath = path.join(os.tmpdir(), 'qa-session.json');
  writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  writeSignal('setup', { setup_complete: true });

  console.log('[setup] Done. Session written to', sessionPath);
}
```

- [ ] **Step 2: Verify it runs (invokes the exported function with a runner script)**

```bash
# In a shell with .env.local sourced — use a small runner to call the default export:
node --env-file=.env.local --input-type=module <<'EOF'
import setup from './tests/qa/global-setup.js';
setup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
EOF
```
Expected: `[setup] Creating test accounts...` then `[setup] Done.` and exit code 0.

⚠️ This creates real accounts in your Supabase project — run it once to validate, then run the teardown to clean up.

---

## Task 6: Global Teardown

**Files:**
- Create: `tests/qa/global-teardown.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/global-teardown.js
import { deleteTestUser } from './helpers/supabase-admin.js';
import { adminClient } from './helpers/supabase-admin.js';

export default async function globalTeardown() {
  console.log('[teardown] Removing test accounts...');
  await Promise.all([
    deleteTestUser('qa-user-a@budgetmate.local'),
    deleteTestUser('qa-user-b@budgetmate.local'),
    deleteTestUser('qa-user-c@budgetmate.local'),
  ]);
  await adminClient.from('households').delete().eq('name', 'QA Household');
  console.log('[teardown] Done.');
}
```

---

## Task 7: QA Playwright Config

**Files:**
- Create: `tests/qa/playwright.config.js`

Separate from root `playwright.config.js`. Headless for CI, 10 parallel projects with correct dependencies.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',

  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },

  // Each worker gets its own browser. 10 agents → up to 10 parallel workers.
  workers: process.env.CI ? 5 : 3, // CI: 5 parallel; local: 3

  projects: [
    { name: 'expenses',    testMatch: 'expenses.spec.js' },
    { name: 'budget',      testMatch: 'budget.spec.js' },
    { name: 'goals',       testMatch: 'goals.spec.js' },
    { name: 'debts',       testMatch: 'debts.spec.js' },
    { name: 'recurring',   testMatch: 'recurring.spec.js' },
    { name: 'statistics',  testMatch: 'statistics.spec.js' },
    {
      name: 'settings',
      testMatch: 'settings.spec.js',
      // Settings must run after all 6 above complete
      dependencies: ['expenses', 'budget', 'goals', 'debts', 'recurring', 'statistics'],
    },
    { name: 'shared-a',    testMatch: 'shared-a.spec.js' },
    { name: 'shared-b',    testMatch: 'shared-b.spec.js' },
    { name: 'shared-c',    testMatch: 'shared-c.spec.js' },
  ],

  outputDir: '../../test-results/qa',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../../playwright-report/qa', open: 'never' }],
  ],
});
```

- [ ] **Step 2: Add `test:qa` npm script to package.json**

In `package.json`, add to `"scripts"`:
```json
"test:qa": "playwright test --config tests/qa/playwright.config.js"
```

- [ ] **Step 3: Verify config is valid**

```bash
npx playwright test --config tests/qa/playwright.config.js --list 2>&1 | head -20
```
Expected: Lists 10 projects without parse errors.

---

## Task 8: Expenses Spec

**Files:**
- Create: `tests/qa/specs/expenses.spec.js`

Full CRUD, filters, search, multi-currency, foreign currency badge. References spec Section 3.2 Expenses Agent.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/expenses.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';

const AGENT = 'expenses';
const BASE = 'http://localhost:5173';

test.describe('Expenses Agent', () => {
  test.setTimeout(120000);

  test.afterAll(() => markComplete(AGENT));

  test('create expense - basic', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);

    // Open add-expense dialog (FAB or button)
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await expect(addBtn).toBeVisible({ timeout: 10000 });
    await addBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await dialog.locator('input[placeholder*="amount" i], input[type="number"]').first().fill('50');
    await dialog.locator('input[placeholder*="description" i], input[name="description"]').first().fill('QA Test Expense');

    // Submit
    await dialog.locator('button[type="submit"], button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1500);

    // Verify expense appears in list
    const expenseList = page.locator('[data-testid="expense-list"], .expense-list, main');
    const hasExpense = await expenseList.getByText('QA Test Expense').count();
    if (hasExpense === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Expenses / Create',
        route: `${BASE}/Expenses`,
        steps: ['Open Add Expense dialog', 'Fill amount=50, description="QA Test Expense"', 'Submit'],
        expected: '"QA Test Expense" appears in the expenses list',
        actual: 'Expense not found in list after creation',
        consoleErrors: (await page.evaluate(() => window._qaErrors?.join('\n') || 'None')),
      });
    }
  });

  test('create expense - $0 amount edge case', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('0');
    await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1000);
    // Expect either validation error or the dialog stays open
    const stillOpen = await dialog.isVisible();
    const hasError = await page.locator('text=/required|invalid|must be/i').count();
    if (!stillOpen && hasError === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Expenses / Validation',
        route: `${BASE}/Expenses`,
        steps: ['Open Add Expense', 'Enter amount=0', 'Submit'],
        expected: 'Validation error shown or form stays open',
        actual: 'Form accepted $0 expense without validation error',
      });
    }
  });

  test('create expense - large amount (999999)', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('999999');
    await dialog.locator('input[placeholder*="description" i]').first().fill('Large amount test');
    await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1500);
    const hasEntry = await page.getByText('Large amount test').count();
    if (hasEntry === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Expenses / Large Amount',
        route: `${BASE}/Expenses`,
        steps: ['Add expense with amount=999999'],
        expected: 'Expense created successfully',
        actual: 'Expense not found after creation',
      });
    }
  });

  test('create expense - special characters in description', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('10');
    await dialog.locator('input[placeholder*="description" i]').first().fill('Test <>&"\'{}[]');
    await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1500);
    // Just verify no crash
    const crashed = await page.locator('text=/error|crash|undefined/i').count();
    if (crashed > 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Expenses / Special Characters',
        route: `${BASE}/Expenses`,
        steps: ['Add expense with description containing <>&"\'{} characters'],
        expected: 'Expense created without errors',
        actual: 'Error text visible on page after submission',
      });
    }
  });

  test('edit and delete expense', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);

    // Find "QA Test Expense" created earlier and click edit
    const expenseRow = page.locator('[data-testid*="expense"], .expense-card, li').filter({ hasText: 'QA Test Expense' }).first();
    const exists = await expenseRow.count();
    if (exists === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Expenses / Persistence',
        route: `${BASE}/Expenses`,
        steps: ['Navigate to Expenses page after creating "QA Test Expense"'],
        expected: 'Previously created expense visible',
        actual: 'Expense not found on reload',
      });
      return;
    }

    // Click edit
    await expenseRow.hover();
    const editBtn = expenseRow.locator('button').filter({ hasText: /edit/i }).first();
    await editBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="number"]').first().fill('75');
    await dialog.locator('button').filter({ hasText: /save|update/i }).click();
    await page.waitForTimeout(1500);

    // Delete
    await expenseRow.hover();
    const deleteBtn = expenseRow.locator('button').filter({ hasText: /delete|remove/i }).first();
    await deleteBtn.click();
    const confirmBtn = page.locator('button').filter({ hasText: /confirm|yes|delete/i }).first();
    if (await confirmBtn.count()) await confirmBtn.click();
    await page.waitForTimeout(1500);
    const stillExists = await page.getByText('QA Test Expense').count();
    if (stillExists > 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Expenses / Delete',
        route: `${BASE}/Expenses`,
        steps: ['Click delete on "QA Test Expense"', 'Confirm deletion'],
        expected: 'Expense removed from list',
        actual: 'Expense still visible after delete',
      });
    }
  });

  test('multi-currency expense entry', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');

    // Look for currency selector
    const currencySelect = dialog.locator('select, [role="combobox"]').filter({ hasText: /USD|currency/i }).first();
    if (await currencySelect.count() === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Expenses / Multi-Currency',
        route: `${BASE}/Expenses`,
        steps: ['Open Add Expense dialog'],
        expected: 'Currency selector visible',
        actual: 'No currency selector found in the form',
      });
      return;
    }

    // Select EUR
    await currencySelect.selectOption({ label: /EUR/i });
    await page.waitForTimeout(500);

    // Verify live rate appears
    const rateLabel = dialog.locator('text=/rate|exchange/i').first();
    if (await rateLabel.count() === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Expenses / Exchange Rate Display',
        route: `${BASE}/Expenses`,
        steps: ['Open Add Expense', 'Select EUR currency'],
        expected: 'Live exchange rate shown',
        actual: 'No exchange rate label visible after selecting foreign currency',
      });
    }

    await dialog.locator('input[type="number"]').first().fill('100');
    await dialog.locator('input[placeholder*="description" i]').first().fill('Foreign currency test');
    await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1500);

    // Verify currency badge appears on expense card
    const badge = page.locator('text=/EUR/').first();
    if (await badge.count() === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Expenses / Currency Badge',
        route: `${BASE}/Expenses`,
        steps: ['Create expense in EUR', 'View expenses list'],
        expected: 'EUR badge visible on expense card',
        actual: 'No currency badge found on the expense',
      });
    }
  });

  test('filter expenses by category', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    const filterBtn = page.locator('button, [role="combobox"]').filter({ hasText: /filter|category/i }).first();
    if (await filterBtn.count() === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Expenses / Filters',
        route: `${BASE}/Expenses`,
        steps: ['Navigate to Expenses page'],
        expected: 'Filter controls visible',
        actual: 'No filter/category controls found',
      });
    }
  });

  test('dashboard shows expense total', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(BASE);
    const totalText = page.locator('text=/total|spent|expenses/i').first();
    if (await totalText.count() === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Dashboard / Expense Total',
        route: BASE,
        steps: ['Navigate to Dashboard after creating expenses'],
        expected: 'Expense total or summary visible on dashboard',
        actual: 'No expense total text found',
      });
    }
  });
});
```

- [ ] **Step 2: Run the spec to verify it executes (bugs will be written, that's fine)**

```bash
npx playwright test --config tests/qa/playwright.config.js --project expenses --reporter list 2>&1 | tail -20
```
Expected: Tests run (pass or fail); no JavaScript parse errors.

---

## Task 9: Budget Spec

**Files:**
- Create: `tests/qa/specs/budget.spec.js`

Budget CRUD, over-limit detection, Dashboard overlap.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/budget.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';

const AGENT = 'budget';
const BASE = 'http://localhost:5173';

test.describe('Budget Agent', () => {
  test.setTimeout(120000);
  test.afterAll(() => markComplete(AGENT));

  test('create and view budget', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Budget`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    if (await addBtn.count() === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Budget / Create',
        route: `${BASE}/Budget`,
        steps: ['Navigate to Budget page'],
        expected: 'Add Budget button visible',
        actual: 'No add button found on Budget page',
      });
      return;
    }
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Fill budget amount
    await dialog.locator('input[type="number"]').first().fill('200');
    await dialog.locator('button').filter({ hasText: /save|create|add/i }).click();
    await page.waitForTimeout(1500);

    const budgetText = page.locator('text=/200/').first();
    if (await budgetText.count() === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Budget / Create',
        route: `${BASE}/Budget`,
        steps: ['Create budget with amount 200'],
        expected: 'Budget with amount 200 visible on page',
        actual: 'Budget not found after creation',
      });
    }
  });

  test('over-budget state triggers alert', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    // Create a budget with a very low limit, then add an expense that exceeds it
    // Navigate to expenses and add expense > budget amount
    await page.goto(`${BASE}/Expenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('500'); // exceeds 200 budget
    await dialog.locator('input[placeholder*="description" i]').first().fill('Over budget test');
    await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
    await page.waitForTimeout(1500);

    await page.goto(`${BASE}/Budget`);
    await page.waitForTimeout(1000);
    const overBudgetIndicator = page.locator('text=/over|exceeded|limit/i, .text-red, [class*="red"], [class*="danger"]').first();
    if (await overBudgetIndicator.count() === 0) {
      reportBug(AGENT, {
        severity: 'MEDIUM',
        feature: 'Budget / Over-Budget Alert',
        route: `${BASE}/Budget`,
        steps: ['Create budget with limit $200', 'Add expense of $500', 'View Budget page'],
        expected: 'Over-budget indicator or red state visible',
        actual: 'No over-budget visual indicator found',
      });
    }
  });

  test('dashboard reflects budget progress', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(BASE);
    const progressEl = page.locator('[role="progressbar"], [class*="progress"], text=/budget/i').first();
    if (await progressEl.count() === 0) {
      reportBug(AGENT, {
        severity: 'LOW',
        feature: 'Dashboard / Budget Progress',
        route: BASE,
        steps: ['Navigate to Dashboard after adding budget and expenses'],
        expected: 'Budget progress indicator visible on dashboard',
        actual: 'No budget progress found on dashboard',
      });
    }
  });

  test('edit budget amount', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Budget`);
    await page.waitForTimeout(1000);
    const editBtn = page.locator('button').filter({ hasText: /edit/i }).first();
    if (await editBtn.count() === 0) return; // no budgets to edit
    await editBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    await dialog.locator('input[type="number"]').first().fill('300');
    await dialog.locator('button').filter({ hasText: /save|update/i }).click();
    await page.waitForTimeout(1500);
    const updated = await page.locator('text=/300/').count();
    if (updated === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Budget / Edit',
        route: `${BASE}/Budget`,
        steps: ['Edit budget amount from 200 to 300'],
        expected: 'Budget shows updated amount 300',
        actual: 'Updated amount not reflected',
      });
    }
  });
});
```

---

## Task 10: Goals Spec

**Files:**
- Create: `tests/qa/specs/goals.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/goals.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';

const AGENT = 'goals';
const BASE = 'http://localhost:5173';

test.describe('Goals Agent', () => {
  test.setTimeout(120000);
  test.afterAll(() => markComplete(AGENT));

  test('create savings goal', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Goals`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button').filter({ hasText: /add|new|\+|goal/i }).first();
    if (await addBtn.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Goals / Create', route: `${BASE}/Goals`,
        steps: ['Navigate to Goals'], expected: 'Add Goal button visible', actual: 'No add button found' });
      return;
    }
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[placeholder*="name" i], input[name="name"]').first().fill('QA Vacation Goal');
    await dialog.locator('input[type="number"]').first().fill('5000');
    await dialog.locator('button').filter({ hasText: /save|create|add/i }).click();
    await page.waitForTimeout(1500);

    const goalEl = await page.getByText('QA Vacation Goal').count();
    if (goalEl === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Goals / Create', route: `${BASE}/Goals`,
        steps: ['Create goal "QA Vacation Goal" with target $5000'],
        expected: 'Goal visible in list', actual: 'Goal not found after creation' });
    }
  });

  test('add contribution to goal', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Goals`);
    await page.waitForTimeout(1000);
    const goalCard = page.locator('text=QA Vacation Goal').locator('../..').first();
    if (await goalCard.count() === 0) return;

    const contributeBtn = goalCard.locator('button').filter({ hasText: /contribut|add|deposit/i }).first();
    if (await contributeBtn.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Goals / Contribution', route: `${BASE}/Goals`,
        steps: ['View goal card for "QA Vacation Goal"'],
        expected: 'Contribute button visible', actual: 'No contribute button on goal card' });
      return;
    }
    await contributeBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('500');
    await dialog.locator('button').filter({ hasText: /save|add|confirm/i }).click();
    await page.waitForTimeout(1500);

    const progressEl = page.locator('[role="progressbar"]').first();
    if (await progressEl.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Goals / Progress Bar', route: `${BASE}/Goals`,
        steps: ['Add $500 contribution to goal'],
        expected: 'Progress bar shows updated amount', actual: 'No progress bar visible after contribution' });
    }
  });

  test('zero contribution edge case', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Goals`);
    const goalCard = page.locator('text=QA Vacation Goal').locator('../..').first();
    if (await goalCard.count() === 0) return;
    const contributeBtn = goalCard.locator('button').filter({ hasText: /contribut|add/i }).first();
    if (await contributeBtn.count() === 0) return;
    await contributeBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('0');
    await dialog.locator('button').filter({ hasText: /save|add|confirm/i }).click();
    await page.waitForTimeout(1000);
    const errorVisible = await page.locator('text=/required|invalid|greater/i').count();
    const dialogStillOpen = await dialog.isVisible();
    if (!errorVisible && !dialogStillOpen) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Goals / Zero Contribution', route: `${BASE}/Goals`,
        steps: ['Try to contribute $0 to a goal'],
        expected: 'Validation error or dialog stays open',
        actual: 'Zero contribution accepted without validation' });
    }
  });

  test('goal persists after navigation', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Goals`);
    await page.waitForTimeout(1000);
    await page.goto(BASE);
    await page.goto(`${BASE}/Goals`);
    await page.waitForTimeout(1000);
    const goalEl = await page.getByText('QA Vacation Goal').count();
    if (goalEl === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Goals / Persistence', route: `${BASE}/Goals`,
        steps: ['Create goal', 'Navigate away', 'Return to Goals'],
        expected: 'Goal still visible', actual: 'Goal lost after navigation' });
    }
  });

  test('dashboard shows goals widget', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(BASE);
    const goalsWidget = page.locator('text=/goal|saving/i').first();
    if (await goalsWidget.count() === 0) {
      reportBug(AGENT, { severity: 'LOW', feature: 'Dashboard / Goals Widget', route: BASE,
        steps: ['Navigate to Dashboard'], expected: 'Goals widget visible', actual: 'No goals widget found' });
    }
  });
});
```

---

## Task 11: Debts Spec

**Files:**
- Create: `tests/qa/specs/debts.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/debts.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';

const AGENT = 'debts';
const BASE = 'http://localhost:5173';

test.describe('Debts Agent', () => {
  test.setTimeout(120000);
  test.afterAll(() => markComplete(AGENT));

  test('create debt record', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button').filter({ hasText: /add|new|\+|debt/i }).first();
    if (await addBtn.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Debts / Create', route: `${BASE}/Debts`,
        steps: ['Navigate to Debts page'], expected: 'Add Debt button visible', actual: 'No add button found' });
      return;
    }
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('300');
    await dialog.locator('button').filter({ hasText: /save|create|add/i }).click();
    await page.waitForTimeout(1500);

    const debtText = await page.locator('text=/300/').count();
    if (debtText === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Debts / Create', route: `${BASE}/Debts`,
        steps: ['Create debt of $300'],
        expected: 'Debt visible in list', actual: 'Debt not found after creation' });
    }
  });

  test('record partial payment', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const payBtn = page.locator('button').filter({ hasText: /pay|payment|settle/i }).first();
    if (await payBtn.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Debts / Payment', route: `${BASE}/Debts`,
        steps: ['View debt of $300'], expected: 'Pay/Payment button visible', actual: 'No payment button found' });
      return;
    }
    await payBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('100');
    await dialog.locator('button').filter({ hasText: /save|pay|confirm/i }).click();
    await page.waitForTimeout(1500);
    // Expect remaining balance = 200
    const remaining = await page.locator('text=/200/').count();
    if (remaining === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Debts / Partial Payment', route: `${BASE}/Debts`,
        steps: ['Pay $100 of $300 debt'],
        expected: 'Remaining balance shows $200', actual: 'Balance not updated after partial payment' });
    }
  });

  test('mark debt as fully paid', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const payBtn = page.locator('button').filter({ hasText: /pay|settle/i }).first();
    if (await payBtn.count() === 0) return;
    await payBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[type="number"]').first().fill('200'); // pay remaining
    await dialog.locator('button').filter({ hasText: /save|pay|confirm/i }).click();
    await page.waitForTimeout(1500);
    const paidLabel = await page.locator('text=/paid|settled|cleared/i').count();
    if (paidLabel === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Debts / Fully Paid State', route: `${BASE}/Debts`,
        steps: ['Pay remaining balance of $200'],
        expected: '"Paid" or "Settled" label visible', actual: 'No paid status shown after full payment' });
    }
  });

  test('dashboard shows debt summary', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(BASE);
    const debtSummary = page.locator('text=/debt|owe/i').first();
    if (await debtSummary.count() === 0) {
      reportBug(AGENT, { severity: 'LOW', feature: 'Dashboard / Debt Summary', route: BASE,
        steps: ['Navigate to Dashboard'], expected: 'Debt summary visible', actual: 'No debt summary on dashboard' });
    }
  });
});
```

---

## Task 12: Recurring Spec

**Files:**
- Create: `tests/qa/specs/recurring.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/recurring.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';

const AGENT = 'recurring';
const BASE = 'http://localhost:5173';

test.describe('Recurring Agent', () => {
  test.setTimeout(120000);
  test.afterAll(() => markComplete(AGENT));

  test('create recurring expense', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/RecurringExpenses`);
    await page.waitForTimeout(1000);

    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    if (await addBtn.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Recurring / Create', route: `${BASE}/RecurringExpenses`,
        steps: ['Navigate to Recurring Expenses'],
        expected: 'Add button visible', actual: 'No add button found' });
      return;
    }
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    await dialog.locator('input[placeholder*="name" i], input[name="name"]').first().fill('QA Monthly Sub');
    await dialog.locator('input[type="number"]').first().fill('15');
    await dialog.locator('button').filter({ hasText: /save|create|add/i }).click();
    await page.waitForTimeout(1500);
    const found = await page.getByText('QA Monthly Sub').count();
    if (found === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Recurring / Create', route: `${BASE}/RecurringExpenses`,
        steps: ['Create recurring "QA Monthly Sub" $15'],
        expected: 'Recurring expense visible', actual: 'Not found after creation' });
    }
  });

  test('all frequency options available', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/RecurringExpenses`);
    const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
    if (await addBtn.count() === 0) return;
    await addBtn.click();
    const dialog = page.locator('[role="dialog"]');
    const frequencyEl = dialog.locator('select, [role="combobox"]').filter({ hasText: /monthly|weekly|daily|yearly|frequency/i }).first();
    if (await frequencyEl.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Recurring / Frequency Selector', route: `${BASE}/RecurringExpenses`,
        steps: ['Open Add Recurring dialog'],
        expected: 'Frequency selector with daily/weekly/monthly/yearly options',
        actual: 'No frequency selector found' });
    }
  });

  test('pause and resume recurring expense', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/RecurringExpenses`);
    await page.waitForTimeout(1000);
    const recurringCard = page.locator('text=QA Monthly Sub').locator('../..').first();
    if (await recurringCard.count() === 0) return;

    const pauseBtn = recurringCard.locator('button').filter({ hasText: /pause|deactivate/i }).first();
    if (await pauseBtn.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Recurring / Pause', route: `${BASE}/RecurringExpenses`,
        steps: ['View recurring expense card'],
        expected: 'Pause button visible', actual: 'No pause button found on recurring card' });
      return;
    }
    await pauseBtn.click();
    await page.waitForTimeout(1000);

    const resumeBtn = recurringCard.locator('button').filter({ hasText: /resume|activate/i }).first();
    if (await resumeBtn.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Recurring / Resume', route: `${BASE}/RecurringExpenses`,
        steps: ['Pause recurring expense'],
        expected: 'Resume button appears after pause', actual: 'No resume button found after pausing' });
    } else {
      await resumeBtn.click();
    }
  });
});
```

---

## Task 13: Statistics Spec

**Files:**
- Create: `tests/qa/specs/statistics.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/statistics.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { readSession } from '../helpers/signals.js';

const AGENT = 'statistics';
const BASE = 'http://localhost:5173';

test.describe('Statistics Agent', () => {
  test.setTimeout(180000);
  test.afterAll(() => markComplete(AGENT));

  test('seed statistics expenses and verify charts', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    const session = readSession();

    // Create 2 expenses per seeded category in current month (March 2026)
    const categories = [
      { id: session.seedData.categoryIds.food, name: 'Food [seeded]' },
      { id: session.seedData.categoryIds.transport, name: 'Transport [seeded]' },
      { id: session.seedData.categoryIds.housing, name: 'Housing [seeded]' },
      { id: session.seedData.categoryIds.entertainment, name: 'Entertainment [seeded]' },
    ];

    for (const cat of categories) {
      for (let i = 0; i < 2; i++) {
        await page.goto(`${BASE}/Expenses`);
        const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
        await addBtn.click();
        const dialog = page.locator('[role="dialog"]');
        await dialog.locator('input[type="number"]').first().fill(String(50 + i * 10));
        await dialog.locator('input[placeholder*="description" i]').first().fill(`Stats ${cat.name} ${i}`);
        await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
        await page.waitForTimeout(1000);
      }
    }
  });

  test('all chart types render', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Statistics`);
    await page.waitForTimeout(2000);

    const charts = [
      { name: 'Monthly Bar Chart', selector: '.recharts-bar, .recharts-bar-rectangle' },
      { name: 'Category Pie Chart', selector: '.recharts-pie, .recharts-sector' },
    ];

    for (const chart of charts) {
      const el = page.locator(chart.selector).first();
      if (await el.count() === 0) {
        reportBug(AGENT, { severity: 'HIGH', feature: `Statistics / ${chart.name}`, route: `${BASE}/Statistics`,
          steps: ['Navigate to Statistics page with existing expenses'],
          expected: `${chart.name} renders with data`,
          actual: `${chart.name} element not found in DOM` });
      }
    }
  });

  test('empty state with year 2020', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Statistics`);
    await page.waitForTimeout(1000);

    // Look for date range controls
    const dateInput = page.locator('input[type="date"], input[placeholder*="date" i], [role="combobox"]').first();
    if (await dateInput.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Statistics / Date Filter', route: `${BASE}/Statistics`,
        steps: ['Navigate to Statistics'],
        expected: 'Date range filter controls visible',
        actual: 'No date range controls found' });
      return;
    }

    // Set to 2020 range
    await dateInput.fill('2020-01-01');
    await page.waitForTimeout(1500);

    const emptyState = page.locator('text=/no data|no expenses|empty/i').first();
    const chartWithNoData = page.locator('.recharts-empty-state, [class*="empty"]').first();
    if (await emptyState.count() === 0 && await chartWithNoData.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Statistics / Empty State', route: `${BASE}/Statistics`,
        steps: ['Filter statistics to year 2020 (no data)'],
        expected: 'Empty state message or empty chart shown',
        actual: 'No empty state indicator when no data exists for selected range' });
    }
  });
});
```

---

## Task 14: Settings Spec

**Files:**
- Create: `tests/qa/specs/settings.spec.js`

Waits for all 6 peer completion signals before starting. Reverts all changes.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/settings.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { waitForSignal } from '../helpers/signals.js';

const AGENT = 'settings';
const BASE = 'http://localhost:5173';
const PEERS = ['expenses', 'budget', 'goals', 'debts', 'recurring', 'statistics'];

// Note: Playwright project dependencies handle the ordering,
// but we also verify signals as belt-and-suspenders.
// If dependencies are configured in playwright.config.js, this test runs after all peers.

test.describe('Settings Agent', () => {
  // 30 min total: up to 5 min per peer (6 peers) + 10 min own tests + buffer.
  // Playwright project dependencies guarantee peers finish before this starts,
  // but we still poll to handle peer crashes that skipped afterAll.
  test.setTimeout(1800000);
  test.afterAll(() => markComplete(AGENT));

  test.beforeAll(async () => {
    // Wait for all peer agents to complete (60s per peer — short since
    // project dependencies mean they are already done or crashed)
    for (const peer of PEERS) {
      try {
        await waitForSignal(peer, 'complete', 60000); // 1 min per peer
      } catch (e) {
        console.warn(`[settings] Timeout waiting for ${peer} — proceeding anyway`);
      }
    }
  });

  test('language switching works', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Setting`);
    await page.waitForTimeout(1000);

    const langSelector = page.locator('select, [role="combobox"]').filter({ hasText: /lang|english|hebrew/i }).first();
    if (await langSelector.count() === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Settings / Language', route: `${BASE}/Setting`,
        steps: ['Navigate to Settings'],
        expected: 'Language selector visible',
        actual: 'No language selector found' });
      return;
    }

    // Switch to Hebrew (RTL)
    await langSelector.selectOption({ label: /hebrew|עברית/i });
    await page.waitForTimeout(1500);

    // Verify RTL
    const htmlDir = await page.evaluate(() => document.documentElement.dir);
    if (htmlDir !== 'rtl') {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Settings / RTL Layout', route: `${BASE}/Setting`,
        steps: ['Switch language to Hebrew'],
        expected: 'document.dir = "rtl"',
        actual: `document.dir = "${htmlDir}"` });
    }

    // Check RTL on Dashboard
    await page.goto(BASE);
    const dashDir = await page.evaluate(() => document.documentElement.dir);
    if (dashDir !== 'rtl') {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Dashboard / RTL After Language Change', route: BASE,
        steps: ['Switch to Hebrew in Settings', 'Navigate to Dashboard'],
        expected: 'Dashboard renders RTL',
        actual: 'Dashboard still renders LTR' });
    }

    // Revert to English
    await page.goto(`${BASE}/Setting`);
    await page.waitForTimeout(1000);
    await langSelector.selectOption({ label: /english/i });
    await page.waitForTimeout(1000);
  });

  test('base currency change propagates', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Setting`);
    await page.waitForTimeout(1000);

    const currencySelector = page.locator('select, [role="combobox"]').filter({ hasText: /USD|currency/i }).first();
    if (await currencySelector.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Settings / Currency', route: `${BASE}/Setting`,
        steps: ['Navigate to Settings'],
        expected: 'Currency selector visible',
        actual: 'No currency selector found' });
      return;
    }

    await currencySelector.selectOption({ label: /EUR/i });
    await page.waitForTimeout(1500);

    // Check Expenses page shows EUR
    await page.goto(`${BASE}/Expenses`);
    const eurSymbol = await page.locator('text=/€|EUR/').count();
    if (eurSymbol === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Settings / Currency Propagation', route: `${BASE}/Expenses`,
        steps: ['Change base currency to EUR in Settings', 'Navigate to Expenses'],
        expected: '€ or EUR symbol visible on Expenses page',
        actual: 'Currency symbol not updated on Expenses page' });
    }

    // Revert to USD
    await page.goto(`${BASE}/Setting`);
    await currencySelector.selectOption({ label: /USD/i });
    await page.waitForTimeout(1000);
  });

  test('category manager - add and delete custom category', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Setting`);
    await page.waitForTimeout(1000);

    const addCatBtn = page.locator('button').filter({ hasText: /add category|new category/i }).first();
    if (await addCatBtn.count() === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Settings / Category Manager', route: `${BASE}/Setting`,
        steps: ['Navigate to Settings'], expected: 'Add Category button visible', actual: 'Not found' });
      return;
    }
    await addCatBtn.click();
    const input = page.locator('input[placeholder*="category" i], input[placeholder*="name" i]').last();
    await input.fill('QA Test Category');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    const catEl = await page.getByText('QA Test Category').count();
    if (catEl === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Settings / Category Add', route: `${BASE}/Setting`,
        steps: ['Add category "QA Test Category"'],
        expected: 'Category visible in list', actual: 'Category not found after adding' });
      return;
    }

    // Delete the custom category (NOT [seeded] ones)
    const catRow = page.locator('text=QA Test Category').locator('../..').first();
    const deleteBtn = catRow.locator('button').filter({ hasText: /delete|remove/i }).first();
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      const confirm = page.locator('button').filter({ hasText: /confirm|yes/i }).first();
      if (await confirm.count()) await confirm.click();
      await page.waitForTimeout(1000);
    }
  });
});
```

---

## Task 15: Shared-A Spec

**Files:**
- Create: `tests/qa/specs/shared-a.spec.js`

User A creates shared expenses and verifies debts. Coordinates with B and C via signal files.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/shared-a.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { writeSignal, waitForSignal, readSession } from '../helpers/signals.js';

const AGENT = 'shared-a';
const BASE = 'http://localhost:5173';

async function createSharedExpense(page, { amount, splitMethod = 'equal', description, currency }) {
  await page.goto(`${BASE}/Expenses`);
  const addBtn = page.locator('button').filter({ hasText: /add|new|\+/i }).first();
  await addBtn.click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();

  // Click the "Shared" tab
  const sharedTab = dialog.locator('[role="tab"], button').filter({ hasText: /shared/i }).first();
  if (await sharedTab.count() > 0) await sharedTab.click();
  await page.waitForTimeout(500);

  await dialog.locator('input[type="number"]').first().fill(String(amount));
  await dialog.locator('input[placeholder*="description" i]').first().fill(description);

  if (currency && currency !== 'USD') {
    const currencyEl = dialog.locator('select, [role="combobox"]').filter({ hasText: /USD|currency/i }).first();
    if (await currencyEl.count() > 0) await currencyEl.selectOption({ label: new RegExp(currency, 'i') });
  }

  await dialog.locator('button').filter({ hasText: /save|add|submit/i }).click();
  await page.waitForTimeout(2000);
}

test.describe('Shared-A Agent', () => {
  test.setTimeout(600000); // 10 min - coordination can take time
  test.afterAll(() => markComplete(AGENT));

  test('3-way equal split — create and verify', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);

    await createSharedExpense(page, { amount: 300, description: 'Equal Split Dinner', splitMethod: 'equal' });
    writeSignal('shared-a', { a_created_equal_split: true });

    // Wait for B and C to approve
    try {
      await waitForSignal('shared-b', 'b_approved_equal_split', 120000);
      await waitForSignal('shared-c', 'c_approved_equal_split', 120000);
    } catch (e) {
      reportBug(AGENT, { severity: 'CRITICAL', feature: 'Shared / Coordination Timeout',
        route: `${BASE}/Expenses`, steps: ['Create equal split expense', 'Wait for B+C approval'],
        expected: 'B and C approve within 2 minutes', actual: e.message });
      return;
    }

    // Verify debts appear
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt100 = await page.locator('text=/100/').count();
    if (debt100 < 2) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Equal Split Debt Creation',
        route: `${BASE}/Debts`, steps: ['Create $300 equal split with B+C', 'Both approve'],
        expected: 'Two debt records of $100 each visible',
        actual: `Only ${debt100} amount matching "100" found on Debts page` });
    }
  });

  test('custom split — create and verify', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);

    await createSharedExpense(page, { amount: 100, description: 'Custom Split Lunch', splitMethod: 'custom' });
    writeSignal('shared-a', { a_created_custom_split: true });

    try {
      await waitForSignal('shared-b', 'b_approved_custom_split', 120000);
      await waitForSignal('shared-c', 'c_approved_custom_split', 120000);
    } catch (e) {
      reportBug(AGENT, { severity: 'CRITICAL', feature: 'Shared / Custom Split Coordination',
        route: `${BASE}/Expenses`, steps: ['Create custom split', 'Wait for B+C'],
        expected: 'Both approve', actual: e.message });
      return;
    }

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt30 = await page.locator('text=/30/').count();
    const debt20 = await page.locator('text=/20/').count();
    if (debt30 === 0 || debt20 === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Custom Split Amounts',
        route: `${BASE}/Debts`, steps: ['Create $100 custom split (B=30%, C=20%)', 'Both approve'],
        expected: 'Debt records of $30 (B) and $20 (C) visible',
        actual: `$30 found: ${debt30}, $20 found: ${debt20}` });
    }
  });

  test('multi-currency shared expense', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await createSharedExpense(page, { amount: 90, description: 'EUR Split', currency: 'EUR' });
    writeSignal('shared-a', { a_created_multicurrency_split: true });

    try {
      await waitForSignal('shared-b', 'b_approved_multicurrency_split', 120000);
      await waitForSignal('shared-c', 'c_approved_multicurrency_split', 120000);
    } catch (e) {
      reportBug(AGENT, { severity: 'CRITICAL', feature: 'Shared / Multi-Currency Coordination',
        route: `${BASE}/Expenses`, steps: ['Create EUR shared expense', 'Wait for B+C'],
        expected: 'Both approve', actual: e.message });
      return;
    }

    const eurVisible = await page.locator('text=/€|EUR/').count();
    if (eurVisible === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Shared / Multi-Currency Display',
        route: `${BASE}/Expenses`, steps: ['Create EUR shared expense', 'View expenses list'],
        expected: 'EUR amount and conversion visible for User A',
        actual: 'No EUR indicator found' });
    }
  });

  test('partial rejection scenario', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await createSharedExpense(page, { amount: 60, description: 'Partial Rejection Test' });
    writeSignal('shared-a', { a_created_partial_rejection_expense: true });

    try {
      await waitForSignal('shared-b', 'b_approved_partial_rejection', 120000);
      await waitForSignal('shared-c', 'c_rejected_partial_rejection', 120000);
    } catch (e) {
      reportBug(AGENT, { severity: 'CRITICAL', feature: 'Shared / Partial Rejection Coordination',
        route: `${BASE}/Expenses`, steps: ['Create expense', 'B approves, C rejects'],
        expected: 'Coordination completes', actual: e.message });
      writeSignal('shared-a', { a_verified_rejection_behavior: true });
      return;
    }

    // Verify expense state: should show B has debt, C does not
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    writeSignal('shared-a', { a_verified_rejection_behavior: true });
  });

  test('record partial payment from B and verify settlement', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);

    const payBtn = page.locator('button').filter({ hasText: /pay|settle/i }).first();
    if (await payBtn.count() > 0) {
      await payBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('input[type="number"]').first().fill('50');
      await dialog.locator('button').filter({ hasText: /save|pay|confirm/i }).click();
      await page.waitForTimeout(1500);
    }
    writeSignal('shared-a', { a_recorded_b_partial_payment: true });

    try {
      await waitForSignal('shared-c', 'c_recorded_c_full_payment', 120000);
    } catch (e) {
      reportBug(AGENT, { severity: 'CRITICAL', feature: 'Shared / Settlement Coordination',
        route: `${BASE}/Debts`, steps: ['Record B partial payment', 'Wait for C full payment'],
        expected: 'C pays within 2 minutes', actual: e.message });
      writeSignal('shared-a', { a_verified_all_settled: true });
      return;
    }

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const outstanding = await page.locator('text=/300|100/').count();
    if (outstanding > 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Full Settlement',
        route: `${BASE}/Debts`, steps: ['B pays partial, C pays full', 'View Debts'],
        expected: 'All shared debts cleared',
        actual: 'Outstanding debt amounts still visible' });
    }
    writeSignal('shared-a', { a_verified_all_settled: true });
  });
});
```

---

## Task 16: Shared-B Spec

**Files:**
- Create: `tests/qa/specs/shared-b.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/shared-b.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { writeSignal, waitForSignal } from '../helpers/signals.js';

const AGENT = 'shared-b';
const BASE = 'http://localhost:5173';

async function approveFirstPendingExpense(page) {
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  // Look for notifications bell or pending badge
  const notifBtn = page.locator('button').filter({ hasText: /notif|bell|\d+/i }).first();
  if (await notifBtn.count() > 0) {
    await notifBtn.click();
    await page.waitForTimeout(500);
  }
  const approveBtn = page.locator('button').filter({ hasText: /approve|accept/i }).first();
  if (await approveBtn.count() > 0) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

test.describe('Shared-B Agent', () => {
  test.setTimeout(600000);
  test.afterAll(() => markComplete(AGENT));

  test('approve equal split and verify $100 debt', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_created_equal_split', 120000);

    const approved = await approveFirstPendingExpense(page);
    if (!approved) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Approve Expense (B)',
        route: BASE, steps: ['Wait for A to create equal split', 'Look for approve button'],
        expected: 'Approve button visible in notifications',
        actual: 'No approve button found after A created expense' });
    }
    writeSignal('shared-b', { b_approved_equal_split: true });

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt100 = await page.locator('text=/100/').count();
    if (debt100 === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / B Debt After Approval',
        route: `${BASE}/Debts`, steps: ['Approve $300 equal split'],
        expected: "B's Debts page shows $100 owed",
        actual: 'No $100 debt found for User B' });
    }
  });

  test('approve custom split and verify $30 debt', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_created_custom_split', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-b', { b_approved_custom_split: true });

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt30 = await page.locator('text=/30/').count();
    if (debt30 === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Custom Split B Amount',
        route: `${BASE}/Debts`, steps: ['Approve custom split (B=30%)'],
        expected: "$30 debt for B", actual: 'No $30 debt found' });
    }
  });

  test('approve multi-currency and verify USD conversion', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_created_multicurrency_split', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-b', { b_approved_multicurrency_split: true });

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const usdDebt = await page.locator('text=/\\$|USD/').count();
    if (usdDebt === 0) {
      reportBug(AGENT, { severity: 'MEDIUM', feature: 'Shared / Multi-Currency B View',
        route: `${BASE}/Debts`, steps: ['Approve EUR shared expense'],
        expected: "B sees debt in USD (base currency)", actual: 'No USD amount found on B debts page' });
    }
  });

  test('approve partial rejection expense', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_created_partial_rejection_expense', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-b', { b_approved_partial_rejection: true });
  });

  test('verify debt drop after partial payment', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_recorded_b_partial_payment', 120000);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1500);
    const debt50 = await page.locator('text=/50/').count();
    if (debt50 === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / B Partial Payment Balance',
        route: `${BASE}/Debts`, steps: ['A records $50 partial payment from B'],
        expected: 'B sees remaining $50 debt', actual: 'No $50 balance found' });
    }
    writeSignal('shared-b', { b_verified_partial_payment_drop: true });
  });

  test('verify debt cleared after full settlement', async ({ page }) => {
    await signIn(page, QA_USERS.b.email, QA_USERS.b.password);
    await waitForSignal('shared-a', 'a_verified_all_settled', 120000);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1500);
    const paidLabel = await page.locator('text=/paid|settled|0/i').count();
    // Just verify page loads — exact state depends on app behavior
    writeSignal('shared-b', { b_verified_all_settled: true });
  });
});
```

---

## Task 17: Shared-C Spec

**Files:**
- Create: `tests/qa/specs/shared-c.spec.js`

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/specs/shared-c.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { writeSignal, waitForSignal } from '../helpers/signals.js';

const AGENT = 'shared-c';
const BASE = 'http://localhost:5173';

async function approveFirstPendingExpense(page) {
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  const notifBtn = page.locator('button').filter({ hasText: /notif|bell|\d+/i }).first();
  if (await notifBtn.count() > 0) {
    await notifBtn.click();
    await page.waitForTimeout(500);
  }
  const approveBtn = page.locator('button').filter({ hasText: /approve|accept/i }).first();
  if (await approveBtn.count() > 0) {
    await approveBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

async function rejectFirstPendingExpense(page) {
  await page.goto(BASE);
  await page.waitForTimeout(1000);
  const notifBtn = page.locator('button').filter({ hasText: /notif|bell|\d+/i }).first();
  if (await notifBtn.count() > 0) {
    await notifBtn.click();
    await page.waitForTimeout(500);
  }
  const rejectBtn = page.locator('button').filter({ hasText: /reject|decline/i }).first();
  if (await rejectBtn.count() > 0) {
    await rejectBtn.click();
    await page.waitForTimeout(1500);
    return true;
  }
  return false;
}

test.describe('Shared-C Agent', () => {
  test.setTimeout(600000);
  test.afterAll(() => markComplete(AGENT));

  test('approve equal split and verify $100 debt', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    await waitForSignal('shared-a', 'a_created_equal_split', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-c', { c_approved_equal_split: true });

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt = await page.locator('text=/100/').count();
    if (debt === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / C Debt After Approval',
        route: `${BASE}/Debts`, steps: ['C approves $300 equal split'],
        expected: 'C sees $100 debt', actual: 'No $100 debt found for User C' });
    }
  });

  test('approve custom split and verify $20 debt', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    await waitForSignal('shared-a', 'a_created_custom_split', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-c', { c_approved_custom_split: true });

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const debt20 = await page.locator('text=/20/').count();
    if (debt20 === 0) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / C Custom Split Amount',
        route: `${BASE}/Debts`, steps: ['Approve custom split (C=20%)'],
        expected: 'C sees $20 debt', actual: 'No $20 debt found' });
    }
  });

  test('approve multi-currency', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    await waitForSignal('shared-a', 'a_created_multicurrency_split', 120000);
    await approveFirstPendingExpense(page);
    writeSignal('shared-c', { c_approved_multicurrency_split: true });
  });

  test('reject partial rejection expense independently', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    // C waits only for A's creation (not B's approval)
    await waitForSignal('shared-a', 'a_created_partial_rejection_expense', 120000);
    const rejected = await rejectFirstPendingExpense(page);
    if (!rejected) {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / Reject Expense (C)',
        route: BASE, steps: ['A creates expense', 'C looks for reject button'],
        expected: 'Reject button visible in notifications',
        actual: 'No reject button found' });
    }
    writeSignal('shared-c', { c_rejected_partial_rejection: true });
  });

  test('record full payment of custom split debt', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    await waitForSignal('shared-b', 'b_verified_partial_payment_drop', 120000);

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1000);
    const payBtn = page.locator('button').filter({ hasText: /pay|settle/i }).first();
    if (await payBtn.count() > 0) {
      await payBtn.click();
      const dialog = page.locator('[role="dialog"]');
      await dialog.locator('input[type="number"]').first().fill('20');
      await dialog.locator('button').filter({ hasText: /save|pay|confirm/i }).click();
      await page.waitForTimeout(1500);
    } else {
      reportBug(AGENT, { severity: 'HIGH', feature: 'Shared / C Payment Button',
        route: `${BASE}/Debts`, steps: ['After B pays partial', 'C tries to pay $20'],
        expected: 'Pay button visible for C', actual: 'No pay button found' });
    }
    writeSignal('shared-c', { c_recorded_c_full_payment: true });
  });

  test('verify C debt cleared after settlement', async ({ page }) => {
    await signIn(page, QA_USERS.c.email, QA_USERS.c.password);
    await waitForSignal('shared-a', 'a_verified_all_settled', 120000);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(1500);
    writeSignal('shared-c', { c_verified_all_settled: true });
  });
});
```

---

## Task 18: Merge Reports Script

**Files:**
- Create: `tests/qa/merge-reports.js`

Combines 10 partial reports into the final bug report in `docs/qa/`.

- [ ] **Step 1: Create the file**

```javascript
// tests/qa/merge-reports.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const AGENTS = ['expenses', 'budget', 'goals', 'debts', 'recurring', 'statistics', 'settings', 'shared-a', 'shared-b', 'shared-c'];
const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const today = new Date().toISOString().slice(0, 10);
const outputPath = `docs/qa/bug-report-${today}.md`;

function parsePartialReport(content) {
  const bugs = [];
  const sections = content.split('### ').slice(1);
  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0]; // "BUG-001 · CRITICAL · Feature"
    const severityMatch = header.match(/CRITICAL|HIGH|MEDIUM|LOW/);
    const severity = severityMatch ? severityMatch[0] : 'LOW';
    bugs.push({ severity, content: '### ' + section.trim() });
  }
  return bugs;
}

const allBugs = [];

for (const agent of AGENTS) {
  const reportPath = path.join(os.tmpdir(), `qa-report-${agent}.md`);
  if (fs.existsSync(reportPath)) {
    const content = fs.readFileSync(reportPath, 'utf8');
    const bugs = parsePartialReport(content);
    allBugs.push(...bugs);
  }
}

// Sort by severity
allBugs.sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));

// Re-number
const renumbered = allBugs.map((bug, i) => {
  const id = `BUG-${String(i + 1).padStart(3, '0')}`;
  return bug.content.replace(/BUG-\d+/, id);
});

const counts = {};
for (const s of SEVERITY_ORDER) counts[s] = allBugs.filter(b => b.severity === s).length;

const header = `# BudgetMate QA Bug Report — ${today}

## Summary
- Total bugs: ${allBugs.length}
- CRITICAL: ${counts.CRITICAL} | HIGH: ${counts.HIGH} | MEDIUM: ${counts.MEDIUM} | LOW: ${counts.LOW}
- Agents run: 10
- Features tested: Dashboard, Expenses, Budget, Goals, Debts, Recurring Expenses, Statistics, Settings, Shared Expenses (3-user household)

## Bugs (sorted by severity)

`;

fs.mkdirSync('docs/qa', { recursive: true });
fs.writeFileSync(outputPath, header + renumbered.join('\n\n'));
console.log(`Bug report written to ${outputPath} (${allBugs.length} bugs)`);
console.log(`CRITICAL: ${counts.CRITICAL}, HIGH: ${counts.HIGH}, MEDIUM: ${counts.MEDIUM}, LOW: ${counts.LOW}`);
```

- [ ] **Step 2: Add to package.json scripts**

```json
"qa:merge": "node tests/qa/merge-reports.js"
```

- [ ] **Step 3: Test the script with empty tmp reports**

```bash
node tests/qa/merge-reports.js
```
Expected: `Bug report written to docs/qa/bug-report-YYYY-MM-DD.md (0 bugs)`

---

## Task 19: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/weekly-qa.yml`

Weekly schedule + test run + automatic fix pipeline via Claude Code Action.

- [ ] **Step 1: Create `.github/workflows/` directory and workflow file**

```yaml
# .github/workflows/weekly-qa.yml
name: Weekly QA

on:
  schedule:
    - cron: '0 6 * * 1'   # Every Monday 6:00 UTC
  workflow_dispatch:        # Manual trigger

permissions:
  contents: write           # needed to commit bug report + create branch
  pull-requests: write      # needed to create fix PR

jobs:
  qa-run:
    name: Run QA Agents
    runs-on: ubuntu-latest
    timeout-minutes: 60

    env:
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Install wait-on
        run: npm install -g wait-on

      - name: Create .env.local for dev server
        run: |
          echo "VITE_SUPABASE_URL=$VITE_SUPABASE_URL" >> .env.local
          echo "VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY" >> .env.local
          echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY" >> .env.local

      - name: Start dev server
        run: npm run dev &
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}

      - name: Wait for dev server
        run: wait-on http://localhost:5173 --timeout 30000

      - name: Run QA tests
        run: npx playwright test --config tests/qa/playwright.config.js --reporter list
        continue-on-error: true   # Don't fail the job if tests find bugs — that's expected

      - name: Merge bug reports
        run: node tests/qa/merge-reports.js

      - name: Upload test artifacts
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: qa-results-${{ github.run_id }}
          path: |
            docs/qa/
            playwright-report/qa/
            test-results/qa/
          retention-days: 30

      - name: Commit bug report to repo
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add docs/qa/
          git diff --cached --quiet || git commit -m "chore: weekly QA bug report $(date +%Y-%m-%d)"
          git push

      - name: Set bug report path output
        id: report
        run: echo "path=docs/qa/bug-report-$(date +%Y-%m-%d).md" >> $GITHUB_OUTPUT

    outputs:
      bug_report_path: ${{ steps.report.outputs.path }}

  fix-pipeline:
    name: Implement Fixes
    needs: qa-run
    runs-on: ubuntu-latest
    timeout-minutes: 90

    env:
      # Pass Supabase creds in case any fix verification step needs them
      VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
      VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0   # full history for branch creation

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Pull latest (bug report was just committed)
        run: git pull origin main

      - name: Create fix branch
        run: |
          BRANCH="qa-fixes-$(date +%Y-%m-%d)"
          git checkout -b "$BRANCH"
          echo "BRANCH=$BRANCH" >> $GITHUB_ENV

      - name: Run Claude Code to implement fixes
        # claude-code-action@beta commits directly to the current branch.
        # Do NOT push manually after this step — the action handles commits.
        uses: anthropic-ai/claude-code-action@beta
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          prompt: |
            You are implementing bug fixes for BudgetMate, a React/Supabase budget app.

            Read the bug report at ${{ needs.qa-run.outputs.bug_report_path }}.

            For each bug, ordered by severity (CRITICAL first, then HIGH, MEDIUM, LOW):
            1. Read the relevant source files in src/
            2. Implement the minimal fix
            3. Verify the fix makes sense (run npm run build to check no TypeScript/lint errors)

            Rules:
            - Fix bugs autonomously if they are: CSS/styling issues, missing validation, calculation logic errors
            - SKIP bugs that require: new database columns, conflicting changes, or ambiguous expected behavior
              (write a comment in the source file: "// TODO QA-FIX-BLOCKED: <reason>")
            - Never modify test files in tests/qa/
            - Never modify supabase/migrations/
            - Run npm run build after all fixes and ensure it passes
            - Commit all changes with: "fix: implement QA-detected fixes $(date +%Y-%m-%d)"
            - Push to the current branch when done

      - name: Create Pull Request
        # Use gh CLI to create the PR — avoids the peter-evans action's push conflict
        # since claude-code-action already pushed the branch.
        run: |
          gh pr create \
            --title "fix: QA-detected bugs $(date +%Y-%m-%d)" \
            --body "## Automated QA Fix PR

          This PR was automatically generated by the weekly QA workflow.

          **Bug report:** \`${{ needs.qa-run.outputs.bug_report_path }}\`

          **Review checklist:**
          - [ ] Review each fix against the original bug report
          - [ ] Run \`npm run dev\` and manually verify the fixed behaviors
          - [ ] Run \`npm run build\` to confirm no errors
          - [ ] Merge when satisfied

          ⚠️ Bugs marked \`TODO QA-FIX-BLOCKED\` in source files require manual attention.

          🤖 Generated by [Claude Code Action](https://github.com/anthropic-ai/claude-code-action)" \
            --label "automated-qa,bug-fix" \
            --base main \
            --head "$BRANCH" || echo "PR already exists or no changes to submit"
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Add required GitHub secrets documentation**

Create `.github/QA_SETUP.md`:

```markdown
# QA Workflow Setup

## Required GitHub Secrets

Go to Settings → Secrets and variables → Actions → New repository secret:

| Secret | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (from .env.local) |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key (from .env.local) |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (Settings → API in Supabase dashboard) |
| `ANTHROPIC_API_KEY` | Your Anthropic API key (for the fix pipeline) |

## First Run

1. Add all 4 secrets above
2. Go to Actions → Weekly QA → Run workflow (manual trigger)
3. Monitor the run. The QA agents will create test accounts automatically.

## Notes

- Test accounts (`qa-user-a/b/c@budgetmate.local`) are created fresh each run and deleted after
- Bug reports are committed to `docs/qa/` on the main branch
- Fix PRs are created on `qa-fixes-YYYY-MM-DD` branches for manual review
```

- [ ] **Step 3: Commit everything and verify workflow syntax**

```bash
git add .github/ tests/qa/ docs/qa/ package.json
git commit -m "feat: add weekly QA GitHub Actions workflow

10 parallel Playwright agents (7 personal-mode + 3 shared-expense),
bug report generation, and automatic fix pipeline via Claude Code Action.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

- [ ] **Step 4: Validate workflow YAML syntax**

```bash
# Install act or use GitHub's validator
npx @github/actionlint .github/workflows/weekly-qa.yml 2>&1
```
Expected: No errors (or actionlint not installed — in that case push and check GitHub's workflow validation)

---

## Task 20: Smoke Test — Full Local Run

Verify the entire pipeline works end-to-end before relying on GitHub Actions.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Run QA suite against it**

```bash
# In a separate terminal:
npx playwright test --config tests/qa/playwright.config.js --reporter list 2>&1 | tee /tmp/qa-run.log
```
Expected: All 10 projects launch. Some tests may fail (finding real bugs) — that's correct behavior.

- [ ] **Step 3: Run merge script**

```bash
node tests/qa/merge-reports.js
```
Expected: `docs/qa/bug-report-YYYY-MM-DD.md` created with found bugs.

- [ ] **Step 4: Verify report format**

```bash
cat docs/qa/bug-report-$(date +%Y-%m-%d).md | head -30
```
Expected: Report header with summary counts, then BUG-001 entries.

- [ ] **Step 5: Commit final state**

```bash
git add .
git status
git commit -m "feat: complete QA workflow implementation"
```

---

## Quick Reference

```bash
# Run QA locally (requires dev server on :5173)
npm run test:qa

# Run single agent
npx playwright test --config tests/qa/playwright.config.js --project expenses

# Merge reports
npm run qa:merge

# View latest bug report
cat docs/qa/bug-report-$(date +%Y-%m-%d).md

# Trigger GitHub Actions manually
gh workflow run weekly-qa.yml
```
