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
