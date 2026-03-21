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
