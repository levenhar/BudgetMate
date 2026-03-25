/**
 * Scenario: delete a settled shared expense → reverse debt appears
 *
 * 1. Bob adds expense of 100 split with Alice
 *    → Debts page (Alice's view): Alice owes Bob 50
 * 2. Alice adds expense of 50 split with Bob
 *    → Debts page (Alice's view): Alice owes Bob 25 (net)
 * 3. Alice marks the debt as settled
 *    → Debts page: no active debts
 * 4. Alice deletes her expense from step 2 (via Settled section on Debts page)
 *    → Debts page: Alice owes Bob 25
 */

import { test, expect } from '@playwright/test';

const BASE  = 'http://localhost:5173';
const BOB   = { email: 'bob@test.com',   password: 'password123', name: 'Bob' };
const ALICE = { email: 'alice@test.com', password: 'password123', name: 'Alice' };

const RUN_ID   = Date.now();
const BOB_DESC   = `Bob100-${RUN_ID}`;
const ALICE_DESC = `Alice50-${RUN_ID}`;

// ─── helpers ─────────────────────────────────────────────────────────────────

async function signIn(page, user) {
  await page.goto(`${BASE}/login`);
  await expect(page.locator('input[type="email"]')).toBeVisible({ timeout: 15000 });
  await page.fill('input[type="email"]', user.email);
  await page.fill('input[type="password"]', user.password);
  await page.click('button[type="submit"]');
  await expect(page).not.toHaveURL(/.*login.*/, { timeout: 20000 });
  // Set English so Debts-page assertions use English text
  await page.evaluate(() => localStorage.setItem('app_language', 'en'));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
}

/**
 * Create a shared expense via the dialog.
 * The participant is searched by email.
 */
async function createSharedExpense(page, { amount, description, participantEmail }) {
  await page.goto(`${BASE}/Expenses`);
  await page.waitForTimeout(1500);

  // Open via custom event
  await page.evaluate(() =>
    window.dispatchEvent(new CustomEvent('open-add-expense', { detail: { tab: 'shared' } }))
  );
  const dialog = page.locator('[role="dialog"]');
  await dialog.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(600);

  // Switch to Shared tab
  const sharedTab = dialog.locator('[role="tab"], button').filter({ hasText: /shared|שיתופי/i }).first();
  if (await sharedTab.count() > 0) { await sharedTab.click(); await page.waitForTimeout(400); }

  // Amount
  await dialog.locator('input[type="number"]').first().fill(String(amount));

  // Description — placeholder varies by language:
  //   Hebrew: "למשל: ארוחת ערב"   English: "E.g.: Dinner"
  const descInput = dialog.locator(
    'input[placeholder*="למשל" i], input[placeholder*="E.g" i], input[placeholder*="תיאור" i], input[placeholder*="description" i], input[placeholder*="dinner" i]'
  ).first();
  if (await descInput.count() > 0) await descInput.fill(description);

  // Category — pick first available.
  // NOTE: the first combobox is the CURRENCY selector (ILS); category is the second one.
  const catCombo = dialog.locator('[role="combobox"]').nth(1);
  if (await catCombo.count() > 0) {
    await catCombo.click();
    await page.waitForTimeout(400);
    const firstOpt = page.locator('[role="option"]').first();
    if (await firstOpt.count() > 0) await firstOpt.click();
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Wait for participant list / search to be ready
  await page.waitForTimeout(1200);

  // Find participant search input (placeholder varies by language)
  const searchInput = dialog.locator(
    'input[placeholder*="חפש" i], input[placeholder*="search" i], input[placeholder*="participant" i], input[placeholder*="משתתף" i]'
  ).first();
  await expect(searchInput).toBeVisible({ timeout: 8000 });
  await searchInput.fill(participantEmail); // search by full email
  await page.waitForTimeout(1800);

  await page.screenshot({ path: `tests/screenshots/create-expense-search-${RUN_ID}.png` });

  // Click the matching result (shown by email or name)
  const emailPart = participantEmail.split('@')[0];
  const participantBtn = page.locator(`button:has-text("${participantEmail}"), li:has-text("${participantEmail}"), [role="option"]:has-text("${participantEmail}")`).first();
  const nameBtn        = page.locator(`button:has-text("${emailPart}"), [role="option"]:has-text("${emailPart}")`).first();

  if (await participantBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await participantBtn.click();
  } else if (await nameBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nameBtn.click();
  } else {
    console.warn(`[createSharedExpense] participant "${participantEmail}" not found in search results`);
    await page.screenshot({ path: `tests/screenshots/create-expense-no-participant-${RUN_ID}.png` });
  }
  await page.waitForTimeout(500);

  // Submit
  const submitBtn = dialog.locator('button[type="submit"]').first();
  const fallbackSubmit = dialog.locator('button').filter({ hasText: /save|add|שמור|הוסף/i }).last();
  const btn = await submitBtn.isVisible().catch(() => false) ? submitBtn : fallbackSubmit;
  await expect(btn).toBeEnabled({ timeout: 5000 });
  await btn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `tests/screenshots/create-expense-done-${RUN_ID}.png` });
}

/**
 * Approve the first pending shared expense notification.
 * The NotificationsPanel uses hardcoded Hebrew regardless of app language:
 *   toggle button text = "התראות"
 *   approve button text = "אשר"
 */
async function approveFirstPendingExpense(page) {
  await page.goto(`${BASE}/Expenses`);
  await page.waitForTimeout(3000); // allow notifications to load

  await page.screenshot({ path: `tests/screenshots/approve-before-${RUN_ID}.png` });

  // Expand notifications panel (always Hebrew "התראות")
  const notifToggle = page.locator('button').filter({ hasText: 'התראות' }).first();
  if (await notifToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
    await notifToggle.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `tests/screenshots/approve-panel-open-${RUN_ID}.png` });

    // Click the approve button — always Hebrew "אשר"
    const approveBtn = page.locator('button').filter({ hasText: 'אשר' }).first();
    if (await approveBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await approveBtn.click();
      await page.waitForTimeout(4000); // wait for server round-trip
      await page.screenshot({ path: `tests/screenshots/approve-done-${RUN_ID}.png` });
      console.log('[approveFirstPendingExpense] approved via notifications panel');
      return;
    }
    console.warn('[approveFirstPendingExpense] approve button "אשר" not found in panel');
  } else {
    console.warn('[approveFirstPendingExpense] notifications panel "התראות" not found');
    await page.screenshot({ path: `tests/screenshots/approve-no-panel-${RUN_ID}.png` });
  }

  // Fallback: pending card (amber) on Expenses page → dialog → approve inside
  const pendingCard = page.locator('.border-amber-200').first();
  if (await pendingCard.isVisible({ timeout: 4000 }).catch(() => false)) {
    await pendingCard.click();
    await page.waitForTimeout(1000);
    const dlgApproveBtn = page.locator('[role="dialog"] button').filter({ hasText: /approve|אשר/i }).first();
    if (await dlgApproveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dlgApproveBtn.click();
      await page.waitForTimeout(4000);
      console.log('[approveFirstPendingExpense] approved via pending card dialog');
    }
  }
}

// ─── tests ───────────────────────────────────────────────────────────────────

test.describe.serial('Settled Expense Delete — reverse debt flow', () => {
  test.use({ viewport: { width: 390, height: 844 }, slowMo: 100 });
  test.setTimeout(180000);

  // ── 1. Bob creates $100 shared expense with Alice ─────────────────────────
  test('Step 1: Bob creates $100 shared expense with Alice', async ({ page }) => {
    await signIn(page, BOB);
    await createSharedExpense(page, {
      amount: 100,
      description: BOB_DESC,
      participantEmail: ALICE.email,
    });
  });

  // ── 2. Alice approves Bob's expense ──────────────────────────────────────
  test('Step 2: Alice approves Bob\'s expense', async ({ page }) => {
    await signIn(page, ALICE);
    await approveFirstPendingExpense(page);
  });

  // ── 3. Verify Alice owes Bob $50 ─────────────────────────────────────────
  test('Step 3: Debts page — Alice owes Bob $50', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `tests/screenshots/step3-debts-${RUN_ID}.png` });

    const pageText = await page.locator('body').innerText();
    console.log('[step3] Debts page (first 400):', pageText.slice(0, 400));

    // Alice should owe Bob — look for 50.00 inside the red "I owe" card
    const iOweCard = page.locator('.bg-red-50').filter({ hasText: /50/ });
    await expect(iOweCard).toBeVisible({ timeout: 8000 });
    console.log('✓ Step 3 passed: Alice owes Bob 50');
  });

  // ── 4. Alice creates $50 shared expense with Bob ──────────────────────────
  test('Step 4: Alice creates $50 shared expense with Bob', async ({ page }) => {
    await signIn(page, ALICE);
    await createSharedExpense(page, {
      amount: 50,
      description: ALICE_DESC,
      participantEmail: BOB.email,
    });
  });

  // ── 5. Bob approves Alice's expense ──────────────────────────────────────
  test('Step 5: Bob approves Alice\'s expense', async ({ page }) => {
    await signIn(page, BOB);
    await approveFirstPendingExpense(page);
  });

  // ── 6. Verify net balance is Alice owes Bob $25 ───────────────────────────
  test('Step 6: Debts page — Alice owes Bob $25 (net)', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `tests/screenshots/step6-debts-${RUN_ID}.png` });

    const pageText = await page.locator('body').innerText();
    console.log('[step6] Debts page (first 400):', pageText.slice(0, 400));

    // Net: Bob owes Alice 25 is cancelled against Alice owes Bob 50 → Alice owes Bob 25
    const iOweCard = page.locator('.bg-red-50').filter({ hasText: /25/ });
    await expect(iOweCard).toBeVisible({ timeout: 8000 });
    // The 50 balance should be gone from the active I-owe section
    const iOwe50 = page.locator('.bg-red-50').filter({ hasText: '50.00' });
    await expect(iOwe50).toHaveCount(0, { timeout: 3000 });
    console.log('✓ Step 6 passed: Alice owes Bob 25 (net)');
  });

  // ── 7. Alice marks debt as settled ────────────────────────────────────────
  test('Step 7: Alice marks debt with Bob as settled', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);

    // "Mark as Settled" button (English due to language setting)
    const settleBtn = page.locator('button').filter({
      hasText: /mark as settled/i,
    }).first();
    await expect(settleBtn).toBeVisible({ timeout: 8000 });
    await settleBtn.click();
    await page.waitForTimeout(800);

    await page.screenshot({ path: `tests/screenshots/step7-settle-confirm-${RUN_ID}.png` });

    // Confirm in the AlertDialog
    const confirmBtn = page.locator('[role="alertdialog"] button').filter({
      hasText: /mark as settled|settle|confirm/i,
    }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();
    await page.waitForTimeout(3500);

    await page.screenshot({ path: `tests/screenshots/step7-after-settle-${RUN_ID}.png` });

    // No active "Mark as Settled" button should remain in the active debt sections
    const activeSettleBtn = page.locator('.bg-red-50 button, .bg-green-50 button').filter({
      hasText: /mark as settled/i,
    });
    await expect(activeSettleBtn).toHaveCount(0, { timeout: 5000 });
    console.log('✓ Step 7 passed: Debt settled');
  });

  // ── 8. Verify no active debts ─────────────────────────────────────────────
  test('Step 8: No active debts after settling', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `tests/screenshots/step8-no-debts-${RUN_ID}.png` });

    const pageText = await page.locator('body').innerText();
    console.log('[step8] Debts page after settle:', pageText.slice(0, 400));

    // Bob should now appear in the "Settled" section (zero-balance users with settled expenses)
    const settledCard = page.locator(`[data-testid="settled-user-${BOB.email}"]`);
    await expect(settledCard).toBeVisible({ timeout: 8000 });
    console.log('✓ Step 8 passed: No active debts; Bob in Settled section');
  });

  // ── 9. Alice deletes her $50 expense via Debts → Settled section ──────────
  test('Step 9: Alice deletes her $50 expense → Alice owes Bob $25', async ({ page }) => {
    await signIn(page, ALICE);
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(2000);

    // Click Bob's entry in the Settled section to open the shared-expenses modal
    const settledCard = page.locator(`[data-testid="settled-user-${BOB.email}"]`);
    await expect(settledCard).toBeVisible({ timeout: 8000 });
    await settledCard.click();
    await page.waitForTimeout(1000);

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: `tests/screenshots/step9-modal-open-${RUN_ID}.png` });

    // Find Alice's expense card (ALICE_DESC) in the modal and click its delete button
    const expenseCards = modal.locator('div.border.rounded-xl');
    const cardCount = await expenseCards.count();
    console.log(`[step9] Expense cards in modal: ${cardCount}`);

    let deleted = false;
    for (let i = 0; i < cardCount; i++) {
      const card = expenseCards.nth(i);
      const cardText = await card.innerText().catch(() => '');
      console.log(`[step9] Card ${i}: "${cardText.slice(0, 80)}"`);
      if (cardText.includes(ALICE_DESC)) {
        // Last button in the card is the trash button
        const buttons = card.locator('button');
        const btnCount = await buttons.count();
        console.log(`[step9] Buttons in card: ${btnCount}`);
        if (btnCount > 0) {
          await buttons.last().click();
          deleted = true;
          console.log(`[step9] Clicked delete button on Alice's expense card`);
          break;
        }
      }
    }

    if (!deleted) {
      await page.screenshot({ path: `tests/screenshots/step9-no-match-${RUN_ID}.png` });
      // Print all card texts for debugging
      for (let i = 0; i < cardCount; i++) {
        const t = await expenseCards.nth(i).innerText().catch(() => '');
        console.log(`Card ${i} text: "${t}"`);
      }
      throw new Error(`Could not find expense card with description "${ALICE_DESC}"`);
    }

    await page.waitForTimeout(1000);
    await page.screenshot({ path: `tests/screenshots/step9-delete-confirm-${RUN_ID}.png` });

    // Confirm delete in the AlertDialog
    const confirmDeleteBtn = page.locator('[role="alertdialog"] button').filter({
      hasText: /delete|מחק|confirm|yes/i,
    }).first();
    await expect(confirmDeleteBtn).toBeVisible({ timeout: 5000 });
    await confirmDeleteBtn.click();
    await page.waitForTimeout(5000); // allow time for reverse-expense creation

    // ── Final assertion: Alice now owes Bob $25 ────────────────────────────
    await page.goto(`${BASE}/Debts`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `tests/screenshots/step9-final-${RUN_ID}.png` });

    const pageText = await page.locator('body').innerText();
    console.log('[step9] Final Debts page:', pageText.slice(0, 600));

    // Alice should owe Bob 25 (shown in the red "I owe" card)
    const iOwe25 = page.locator('.bg-red-50').filter({ hasText: /25/ });
    await expect(iOwe25).toBeVisible({ timeout: 8000 });

    // 50.00 should NOT appear as an active debt
    const iOwe50 = page.locator('.bg-red-50').filter({ hasText: '50.00' });
    await expect(iOwe50).toHaveCount(0, { timeout: 3000 });

    console.log('✓ Step 9 passed: Alice owes Bob 25 after deleting settled expense');
  });
});
