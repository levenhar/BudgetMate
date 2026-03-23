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
        const addBtn = page.getByRole('button', { name: /add expense/i });
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

    // Set to 2020 range — may be a combobox (Radix Select), not a plain input
    try {
      await dateInput.click();
      await page.waitForTimeout(500);
      const option2020 = page.getByRole('option', { name: /2020/ }).first();
      if (await option2020.count() > 0) {
        await option2020.click();
      } else {
        await page.keyboard.press('Escape');
      }
    } catch (_) { /* date filter interaction failed — continue to check empty state */ }
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
