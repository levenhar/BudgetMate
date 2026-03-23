// tests/qa/helpers/auth.js
const BASE_URL = 'http://localhost:5173';

export async function signIn(page, email, password) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 15000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(url => !url.toString().includes('login'), { timeout: 20000 });
  // Force English UI so all text-based selectors work reliably (default is Hebrew)
  await page.evaluate(() => localStorage.setItem('app_language', 'en'));
  await page.reload();
  await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
  await page.waitForTimeout(800);
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
  a: { email: 'qa-user-a@budgetmate.test', password: 'QAtest!2026' },
  b: { email: 'qa-user-b@budgetmate.test', password: 'QAtest!2026' },
  c: { email: 'qa-user-c@budgetmate.test', password: 'QAtest!2026' },
};

export const BASE_URL_EXPORT = BASE_URL;

/**
 * Open the Add Expense dialog via the custom DOM event that Layout listens for.
 * Also auto-selects the first available category (required for the submit button to enable).
 */
export async function openAddExpenseDialog(page, tab = 'expense') {
  await page.evaluate((t) => {
    window.dispatchEvent(new CustomEvent('open-add-expense', { detail: { tab: t } }));
  }, tab);
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });

  if (tab === 'expense') {
    // Auto-select first available category so the submit button is enabled
    const catTrigger = dialog.locator('[role="combobox"]').first();
    if (await catTrigger.count() > 0) {
      await catTrigger.click();
      await page.waitForTimeout(300);
      const firstOption = page.locator('[role="option"]').first();
      if (await firstOption.count() > 0) {
        await firstOption.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(200);
    }
  }
}

/**
 * Expand the "More Options" section of the expense form to reveal
 * the description, merchant, and payment method fields.
 */
export async function expandMoreOptions(page) {
  const dialog = page.locator('[role="dialog"]');
  const moreBtn = dialog.locator('button').filter({ hasText: /more options/i }).first();
  if (await moreBtn.count() > 0) {
    await moreBtn.click();
    await page.waitForTimeout(300);
  }
}
