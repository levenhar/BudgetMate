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
