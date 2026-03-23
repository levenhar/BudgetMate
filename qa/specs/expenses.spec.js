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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
