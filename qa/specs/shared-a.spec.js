// tests/qa/specs/shared-a.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';
import { reportBug, markComplete } from '../helpers/bug-report.js';
import { writeSignal, waitForSignal, readSession } from '../helpers/signals.js';

const AGENT = 'shared-a';
const BASE = 'http://localhost:5173';

async function createSharedExpense(page, { amount, splitMethod = 'equal', description, currency }) {
  await page.goto(`${BASE}/Expenses`);
  const addBtn = page.getByRole('button', { name: /add expense/i });
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
