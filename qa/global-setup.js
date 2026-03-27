// tests/qa/global-setup.js
import { writeFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  adminClient,
  seedTestUser, createHousehold, setHouseholdMode,
  seedCategory, seedBudget, seedRecurringExpense,
  seedSavingsGoal, seedDebt,
} from './helpers/supabase-admin.js';
import { writeSignal } from './helpers/signals.js';

// Permanent QA users — auth accounts exist in Supabase, never deleted.
// Password: QAtest!2026  (set once in Supabase Dashboard, not managed here)
const USER_A = 'qa-user-a@budgetmate.test';
const USER_B = 'qa-user-b@budgetmate.test';
const USER_C = 'qa-user-c@budgetmate.test';

export default async function globalSetup() {
  // ── Idempotency: skip re-seed if session file is < 10 minutes old ──────
  const sessionPath = path.join(os.tmpdir(), 'qa-session.json');
  if (existsSync(sessionPath)) {
    const ageMs = Date.now() - statSync(sessionPath).mtimeMs;
    if (ageMs < 10 * 60 * 1000) {
      console.log(`[setup] Session file is fresh (${Math.round(ageMs / 1000)}s old) — skipping re-seed.`);
      writeSignal('setup', { setup_complete: true });
      return;
    }
  }

  // Verify Supabase connectivity before doing anything
  console.log('[setup] Verifying Supabase connection...');
  const { error: pingError } = await adminClient.from('user_profiles').select('id').limit(1);
  if (pingError) {
    throw new Error(
      `[setup] Cannot reach Supabase: ${pingError.message}\n` +
      `Check VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local`
    );
  }
  console.log('[setup] Supabase connection OK.');

  console.log('[setup] Seeding test accounts...');

  // Seed DB rows for permanent QA users (auth accounts already exist in Supabase)
  const idA = await seedTestUser(USER_A, 'QA User A');
  const idB = await seedTestUser(USER_B, 'QA User B');
  const idC = await seedTestUser(USER_C, 'QA User C');

  console.log('[setup] Creating household...');
  const householdId = await createHousehold(USER_A, [USER_B, USER_C]);
  await Promise.all([
    setHouseholdMode(USER_A, householdId),
    setHouseholdMode(USER_B, householdId),
    setHouseholdMode(USER_C, householdId),
  ]);

  console.log('[setup] Seeding baseline data...');
  const [foodId, transportId, housingId, entertainmentId] = await Promise.all([
    seedCategory(USER_A, 'Food [seeded]'),
    seedCategory(USER_A, 'Transport [seeded]'),
    seedCategory(USER_A, 'Housing [seeded]'),
    seedCategory(USER_A, 'Entertainment [seeded]'),
  ]);

  const [foodBudgetId, transportBudgetId, housingBudgetId, entertainmentBudgetId] = await Promise.all([
    seedBudget(USER_A, foodId, 'Food [seeded]'),
    seedBudget(USER_A, transportId, 'Transport [seeded]'),
    seedBudget(USER_A, housingId, 'Housing [seeded]'),
    seedBudget(USER_A, entertainmentId, 'Entertainment [seeded]'),
  ]);

  const [recurringId, goalId, debtId] = await Promise.all([
    seedRecurringExpense(USER_A, housingId, 'Housing [seeded]'),
    seedSavingsGoal(USER_A),
    seedDebt(USER_A),
  ]);

  const session = {
    users: {
      a: { email: USER_A, password: 'QAtest!2026', id: idA },
      b: { email: USER_B, password: 'QAtest!2026', id: idB },
      c: { email: USER_C, password: 'QAtest!2026', id: idC },
    },
    householdId,
    seedData: {
      categoryIds: { food: foodId, transport: transportId, housing: housingId, entertainment: entertainmentId },
      budgetIds: { food: foodBudgetId, transport: transportBudgetId, housing: housingBudgetId, entertainment: entertainmentBudgetId },
      recurringExpenseId: recurringId,
      savingsGoalId: goalId,
      debtId,
    },
  };

  writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  writeSignal('setup', { setup_complete: true });

  console.log('[setup] Done. Session written to', sessionPath);
}
