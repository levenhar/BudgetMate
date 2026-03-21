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
