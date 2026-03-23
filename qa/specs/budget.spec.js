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

    const addBtn = page.getByRole('button', { name: /set budget|add budget|new budget/i });
    if (await addBtn.count() === 0) {
      reportBug(AGENT, {
        severity: 'HIGH',
        feature: 'Budget / Create',
        route: `${BASE}/Budget`,
        steps: ['Navigate to Budget page'],
        expected: 'Set/Add Budget button visible',
        actual: 'No add budget button found on Budget page',
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
    const addBtn = page.getByRole('button', { name: /add expense/i });
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
    const progressEl = page.locator('[role="progressbar"], [class*="progress"]').first();
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
