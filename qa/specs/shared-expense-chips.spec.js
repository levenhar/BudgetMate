// qa/specs/shared-expense-chips.spec.js
import { test, expect } from '@playwright/test';
import { signIn, QA_USERS } from '../helpers/auth.js';

const BASE = 'http://localhost:5173';

test.describe('Shared expense participant chips', () => {
  test.setTimeout(60000);

  test('expanding a shared expense shows participant chips with names', async ({ page }) => {
    await signIn(page, QA_USERS.a.email, QA_USERS.a.password);
    await page.goto(`${BASE}/Expenses`);
    await page.waitForTimeout(1500);

    // Click any shared expense row to expand it
    const rows = page.locator('.group.flex.items-center');
    const count = await rows.count();
    let expanded = false;
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      // Look for the shared expense badge (green Users, blue Send, or amber Clock)
      const hasSharedBadge = await row.locator('.bg-green-50.border-green-200, .bg-blue-50.border-blue-200, .bg-blue-50\\/40').count();
      if (hasSharedBadge > 0) {
        await row.click();
        await page.waitForTimeout(600);
        expanded = true;
        break;
      }
    }

    if (!expanded) {
      test.skip(); // No shared expenses available for this user — skip
      return;
    }

    // After expanding, the detail panel should contain "Shared with:" label
    const sharedWithLabel = page.locator('text=/shared with/i').first();
    await expect(sharedWithLabel).toBeVisible({ timeout: 3000 });

    // At least one avatar chip should be visible (rounded-full pill with a name)
    const chips = page.locator('.rounded-full').filter({ hasText: /.+/ });
    await expect(chips.first()).toBeVisible({ timeout: 3000 });
  });
});
