// tests/qa/global-setup.js
import { writeFileSync } from 'fs';
import path from 'path';
import os from 'os';
import {
  createTestUser, createHousehold, setHouseholdMode,
  seedCategory, seedBudget, seedRecurringExpense,
  seedSavingsGoal, seedDebt,
} from './helpers/supabase-admin.js';
import { writeSignal } from './helpers/signals.js';

const USER_A = 'qa-user-a@budgetmate.local';
const USER_B = 'qa-user-b@budgetmate.local';
const USER_C = 'qa-user-c@budgetmate.local';
const PASSWORD = 'QAtest!2026';

export default async function globalSetup() {
  console.log('[setup] Creating test accounts...');

  const [idA, idB, idC] = await Promise.all([
    createTestUser(USER_A, PASSWORD, 'QA User A'),
    createTestUser(USER_B, PASSWORD, 'QA User B'),
    createTestUser(USER_C, PASSWORD, 'QA User C'),
  ]);

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
      a: { email: USER_A, password: PASSWORD, id: idA },
      b: { email: USER_B, password: PASSWORD, id: idB },
      c: { email: USER_C, password: PASSWORD, id: idC },
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

  const sessionPath = path.join(os.tmpdir(), 'qa-session.json');
  writeFileSync(sessionPath, JSON.stringify(session, null, 2));
  writeSignal('setup', { setup_complete: true });

  console.log('[setup] Done. Session written to', sessionPath);
}
