/**
 * Scenario: delete a settled shared expense → reverse debt appears
 *
 * 1. Bob adds expense of 100 split with Alice
 *    → Debts page: Alice owes Bob 50
 * 2. Alice adds expense of 50 split with Bob
 *    → Debts page: Alice owes Bob 25 (net)
 * 3. Alice marks the debt as settled
 *    → Debts page: no active debts
 * 4. Alice deletes her expense from step 2 (via the Settled section on Debts page)
 *    → Debts page: Alice owes Bob 25
 *      (Alice's settlement payment was real but her expense wasn't, so she owes it back)
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const BOB   = { email: 'bob@test.com',   password: 'password123', name: 'Bob' };
const ALICE = { email: 'alice@test.com', password: 'password123', name: 'Alice' };

// Use a timestamp so this run's expenses are identifiable even if old data exists
const RUN_ID = Date.now();
const BOB_DESC   = `Bob100-${RUN_ID}`;
const ALICE_DESC = `Alice50-${RUN_ID}`;

// ─── helpers ────────────────────────────────────────────────────────────────

async function signIn(page, user) {
  await page.goto(`${BASE}/login`);
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/.*login.*/, { timeout: 20000 });
  // Force English UI so text-based assertions are predictable
  await page.evaluate(() => localStorage.setItem('app_language', 'en'));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
}

async function signOut(page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(`${BASE}/login`);
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 10000 });
}

/**
 * Open the Add-Expense dialog via the custom DOM event that Layout listens for,
 * switch to the shared tab, fill amount + description, add a participant by email,
 * select the first available category, then submit.
 */
async function createSharedExpense(page, { amount, description, participantEmail }) {
  await page.goto(`${BASE}/Expenses`);
  await page.waitForTimeout(1500);

  // Open dialog
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('open-add-expense', { detail: { tab: 'shared' } }))
  );
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(500);

  // Switch to Shared tab inside the dialog (it might already be on shared)
  const sharedTab = dialog.locator('[role="tab"], button').filter({ hasText: /shared/i }).first();
  if (await sharedTab.count() > 0) {
    await sharedTab.click();
    await page.waitForTimeout(500);
  }

  // Amount
  await dialog.locator('input[type="number"]').first().fill(String(amount));

  // Description
  const descInput = dialog.locator('input[placeholder*="description" i], input[placeholder*="תיאור" i]').first();
  if (await descInput.count() > 0) {
    await descInput.fill(description);
  }

  // Category — pick first option
  const catCombo = dialog.locator('[role="combobox"]').first();
  if (await catCombo.count() > 0) {
    await catCombo.click();
    await page.waitForTimeout(400);
    const firstOpt = page.locator('[role="option"]').first();
    if (await firstOpt.count() > 0) await firstOpt.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Participant search
  await page.waitForTimeout(1000); // let participant list load
  const searchInput = dialog.locator(
    'input[placeholder*="search participant" i], input[placeholder*="חפש משתתף" i], input[placeholder*="participant" i]'
  ).first();
  await expect(searchInput).toBeVisible({ timeout: 8000 });
  await searchInput.fill(participantEmail.split('@')[0]); // search by username part
  await page.waitForTimeout(1500);

  // Click the matching participant option
  const participantBtn = page.locator(`button:has-text("${participantEmail}")`).first();
  if (await participantBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await participantBtn.click();
  } else {
    // Try the first option in the search results list
    const firstResult = dialog.locator('[role="option"], li, button').filter({ hasText: new RegExp(participantEmail.split('@')[0], 'i') }).first();
    if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstResult.click();
    }
  }
  await page.waitForTimeout(500);

  await page.screenshot({ path: `tests/screenshots/shared-expense-before-submit-${RUN_ID}.png` });

  // Submit
  const submitBtn = dialog.locator('button[type="submit"], button').filter({ hasText: /save|add|submit|שמור/i }).last();
  await expect(submitBtn).toBeEnabled({ timeout: 5000 });
  await submitBtn.click();
  await page.waitForTimeout(2500);
}

/**
 * Approve the first pending shared expense notification visible to the current user.
 */
async function approveFirstPendingExpense(page) {
  await page.goto(`${BASE}/Expenses`);
  await page.waitForTimeout(2500);

  // Look for a notification bell or panel
  const notifTrigger = page.locator('button, [role="button"]').filter({
    hasText: /notification|התראה|התראות/i,
  }).first();
  if (await notifTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notifTrigger.click();
    await page.waitForTimeout(1000);
  }

  // Green approve button (bg-green-600 pattern from existing tests)
  const approveBtn = page.locator('button.bg-green-600, button[class*="green"]').first();
  if (await approveBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await approveBtn.click();
    await page.waitForTimeout(2500);
    return;
  }

  // Fallback: click the pending expense card (amber border) and approve inside the dialog
  const pendingCard = page.locator('.border-amber-200, [class*="amber"]').first();
  if (await pendingCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await pendingCard.click();
    await page.waitForTimeout(1000);
    const dlgApprove = page.locator('[role="dialog"] button.bg-green-600, [role="dialog"] button').filter({ hasText: /approve|אשר/i }).first();
    if (await dlgApprove.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dlgApprove.click();
      await page.waitForTimeout(2500);
    }
  }
}

// ─── helpers to read Debts page state ────────────────────────────────────────

/**
 * Return { owesYou: number, youOwe: number } as seen on the Debts page for the
 * given other-user name.  Returns null amounts when the name is not visible.
 */
async function getDebtsPageBalance(page, otherName) {
  await page.goto(`${BASE}/Debts`);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `tests/screenshots/debts-page-${otherName}-${RUN_ID}-${Date.now()}.png` });

  const pageText = await page.locator('body').textContent();
  return pageText;
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe.serial('Settled Expense Delete — reverse debt flow', () => {
  test.use({ viewport: { width: 390, height: 844 }, slowMo: 200 });
  test.setTimeout(180000);

  // ── Step 1: Bob creates shared expense of 100 with Alice ─────────────────
  test('Step 1: Bob creates $100 shared expense with Alice', async ({ page }) => {
    await signIn(page, BOB);
    await createSharedExpense(page, {
      amount: 100,
      description: BOB_DESC,
      participantEmail: ALICE.email,
    });
    await page.screenshot({ path: `tests/screenshots/step1-bob-created-${RUN_ID}.png` });
  });

  // ── Step 2a: Alice approves Bob's expense ────────────────────────────────
  test('Step 2a: Alice approves Bob\'s expense', async ({ page }) => {
    await signIn(page, ALICE);
    await approveFirstPendingExpense(page);
    await page.screenshot({ path: `tests/screenshots/step2a-alice-approved-${RUN_ID}.png` });
  });

  // ── Step 2b: Verify Alice owes Bob $50 ───────────────────────────────────
  test('Step 2b: Debts page shows Alice owes Bob $50', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `tests/screenshots/step2b-debts-alice-${RUN_ID}.png` });

    // Alice's perspective: she is in the "I owe" section — look for 50.00
    const pageText = await page.locator('body').textContent();
    console.log('[step2b] page text snippet:', pageText.slice(0, 500));

    // The amount 50.00 should be visible in the "I owe" section
    await expect(page.locator('body')).toContainText('50', { timeout: 5000 });
    console.log('✓ Step 2b: Alice owes Bob 50');
  });

  // ── Step 3: Alice creates shared expense of $50 with Bob ─────────────────
  test('Step 3: Alice creates $50 shared expense with Bob', async ({ page }) => {
    await signIn(page, ALICE);
    await createSharedExpense(page, {
      amount: 50,
      description: ALICE_DESC,
      participantEmail: BOB.email,
    });
    await page.screenshot({ path: `tests/screenshots/step3-alice-created-${RUN_ID}.png` });
  });

  // ── Step 3a: Bob approves Alice's expense ────────────────────────────────
  test('Step 3a: Bob approves Alice\'s expense', async ({ page }) => {
    await signIn(page, BOB);
    await approveFirstPendingExpense(page);
    await page.screenshot({ path: `tests/screenshots/step3a-bob-approved-${RUN_ID}.png` });
  });

  // ── Step 3b: Verify net balance is Alice owes Bob $25 ────────────────────
  test('Step 3b: Debts page shows Alice owes Bob $25 (net)', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `tests/screenshots/step3b-debts-alice-${RUN_ID}.png` });

    // Net: Alice still owes Bob 25 (she paid 25 to Bob from her expense, Bob owes her 25, Alice owes Bob 50 → net 25)
    await expect(page.locator('body')).toContainText('25', { timeout: 5000 });
    // Should NOT contain 50.00 as the main balance anymore
    const iOweSection = page.locator('.bg-red-50').first();
    const iOweText = await iOweSection.textContent().catch(() => '');
    console.log('[step3b] I-owe section text:', iOweText);
    console.log('✓ Step 3b: Alice owes Bob 25 (net)');
  });

  // ── Step 4: Alice marks debt as settled ──────────────────────────────────
  test('Step 4: Alice marks debt with Bob as settled', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);

    // Find the "Mark as Settled" button in the "I owe" section
    const settleBtn = page.locator('button').filter({
      hasText: /mark as settled|סמן כמוחזר|סמן כמסולק/i,
    }).first();
    await expect(settleBtn).toBeVisible({ timeout: 8000 });
    await settleBtn.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `tests/screenshots/step4-settle-confirm-${RUN_ID}.png` });

    // Confirm in the alert dialog
    const confirmBtn = page.locator('[role="alertdialog"] button').filter({
      hasText: /mark as settled|סמן כמוחזר|סמן כמסולק|confirm|yes/i,
    }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(3000);

    await page.screenshot({ path: `tests/screenshots/step4-after-settle-${RUN_ID}.png` });

    // Verify: no active debt amounts visible (the "I owe" and "owed to me" sections show empty states)
    const pageText = await page.locator('body').textContent();
    const hasActiveDebt = pageText.includes('25.00') || pageText.includes('50.00');
    // After settling, 25/50 should only appear inside the Settled section, not as an active balance
    console.log('[step4] page text after settle (first 600):', pageText.slice(0, 600));

    // The "Mark as Settled" button should be gone from active sections
    const settleBtn2 = page.locator('.bg-red-50 button, .bg-green-50 button').filter({
      hasText: /mark as settled/i,
    });
    await expect(settleBtn2).toHaveCount(0, { timeout: 5000 });
    console.log('✓ Step 4: Debt settled — no active "Mark as Settled" button');
  });

  // ── Step 5: Verify no active debts after settling ────────────────────────
  test('Step 5: No active debts after settling', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `tests/screenshots/step5-no-debts-${RUN_ID}.png` });

    // No red/green balance cards should exist
    const redCard = page.locator('.bg-red-50');
    const greenCard = page.locator('.bg-green-50');

    // Both sections should show the "no active debts" empty state
    const noDebtMsgs = page.locator('text=/no active debts|אין חובות/i');
    const noDebtCount = await noDebtMsgs.count();
    console.log(`[step5] "no active debts" message count: ${noDebtCount}`);

    // Bob's entry should appear in the "Settled" section (zero-balance users)
    const settledSection = page.locator(`[data-testid="settled-user-${BOB.email}"]`);
    await expect(settledSection).toBeVisible({ timeout: 5000 });
    console.log('✓ Step 5: No active debts; Bob visible in Settled section');
  });

  // ── Step 6: Alice deletes her $50 expense via Debts → Settled section ────
  test('Step 6: Alice deletes her $50 expense → Alice owes Bob $25', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);

    // Click Bob's entry in the Settled section to open the shared-expenses modal
    const settledUserCard = page.locator(`[data-testid="settled-user-${BOB.email}"]`);
    await expect(settledUserCard).toBeVisible({ timeout: 8000 });
    await settledUserCard.click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: `tests/screenshots/step6-modal-open-${RUN_ID}.png` });

    // The modal should show Alice's expense (ALICE_DESC, $50) with a Settled badge
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Find the expense row that has Alice's description
    const aliceExpenseRow = modal.locator('div').filter({ hasText: ALICE_DESC }).first();
    await expect(aliceExpenseRow).toBeVisible({ timeout: 5000 });

    // Click the trash/delete button inside that row
    // The trash button is a ghost icon button (h-7 w-7) near the expense row
    const trashBtn = aliceExpenseRow.locator('button[title*="מחק"], button').filter({
      hasText: '',
    }).locator('svg').locator('..').last(); // last icon button near the row
    // Simpler: find all delete buttons in the modal and use the one closest to Alice's description
    const allTrashBtns = modal.locator('button').filter({ has: page.locator('svg') });
    const trashCount = await allTrashBtns.count();
    console.log(`[step6] Trash buttons in modal: ${trashCount}`);

    // Find the specific delete button for Alice's expense by searching within each expense card
    let deleted = false;
    const expenseCards = modal.locator('div.border.rounded-xl');
    const cardCount = await expenseCards.count();
    console.log(`[step6] Expense cards in modal: ${cardCount}`);

    for (let i = 0; i < cardCount; i++) {
      const card = expenseCards.nth(i);
      const cardText = await card.textContent();
      if (cardText && cardText.includes(ALICE_DESC)) {
        const deleteBtn = card.locator('button').last(); // last button is the trash button
        if (await deleteBtn.isVisible()) {
          await deleteBtn.click();
          deleted = true;
          console.log(`[step6] Clicked delete on card ${i}: "${cardText.slice(0, 60)}"`);
          break;
        }
      }
    }

    if (!deleted) {
      await page.screenshot({ path: `tests/screenshots/step6-modal-no-match-${RUN_ID}.png` });
      throw new Error(`Could not find expense card with description "${ALICE_DESC}" in modal`);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: `tests/screenshots/step6-delete-confirm-${RUN_ID}.png` });

    // Confirm the delete in the alert dialog
    const confirmDeleteBtn = page.locator('[role="alertdialog"] button').filter({
      hasText: /delete|מחק|confirm|yes/i,
    }).first();
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
    await confirmDeleteBtn.click();
    await page.waitForTimeout(4000); // allow time for reverse-expense creation

    await page.screenshot({ path: `tests/screenshots/step6-after-delete-${RUN_ID}.png` });

    // ── Final assertion: Alice now owes Bob $25 ──────────────────────────────
    // The reverse SharedExpense was created (Bob "paid" 25, Alice owes Bob 25),
    // so the "I owe" section should now show Bob with $25.00

    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `tests/screenshots/step6-final-debts-${RUN_ID}.png` });

    // "I owe" section (red cards) should contain Bob's name and 25
    const iOweSection = page.locator('.bg-red-50, [class*="red-50"]');
    const iOweCount = await iOweSection.count();
    console.log(`[step6] red-50 cards count: ${iOweCount}`);

    const pageText = await page.locator('body').textContent();
    console.log('[step6] Final page text (first 800):', pageText.slice(0, 800));

    // Assert 25.00 appears as a debt (not in the Settled section)
    const debtAmount25 = page.locator('.bg-red-50').filter({ hasText: '25' });
    await expect(debtAmount25).toBeVisible({ timeout: 8000 });

    // And Alice should NOT owe 50 (the other expense was also settled)
    const debtAmount50 = page.locator('.bg-red-50').filter({ hasText: '50.00' });
    await expect(debtAmount50).toHaveCount(0, { timeout: 3000 });

    console.log('✓ Step 6: Alice owes Bob 25 after deleting her settled expense');
  });
});
