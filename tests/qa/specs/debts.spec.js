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
