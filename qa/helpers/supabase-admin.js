// tests/qa/helpers/supabase-admin.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Copy .env.example to .env.local and add SUPABASE_SERVICE_ROLE_KEY.'
  );
}

export const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/**
 * Permanent QA users — created once in Supabase, never deleted.
 * Password: QAtest!2026
 * To recreate: Supabase Dashboard → Authentication → Users → Add user.
 */
const QA_USER_EMAILS = [
  'qa-user-a@budgetmate.test',
  'qa-user-b@budgetmate.test',
  'qa-user-c@budgetmate.test',
];

/**
 * Get an auth user's UUID by email via a SQL RPC.
 * Avoids the GoTrue admin API (listUsers / updateUser) which is unreliable
 * on this project. The function `get_auth_user_id_by_email` must exist in Supabase.
 */
async function getAuthUserIdByEmail(email) {
  const { data, error } = await adminClient.rpc('get_auth_user_id_by_email', { p_email: email });
  if (error) throw new Error(`getAuthUserIdByEmail(${email}): ${error.message}`);
  if (!data) throw new Error(
    `QA user not found: ${email}\n` +
    `Create it in Supabase Dashboard → Authentication → Users with password "QAtest!2026".`
  );
  return data;
}

/**
 * Seed DB rows for a permanent QA user.
 * Auth user must already exist — this only manages user_profiles + user_settings.
 */
export async function seedTestUser(email, fullName) {
  // Clean any leftover rows from previous runs
  await adminClient.from('user_settings').delete().eq('user_email', email);
  await adminClient.from('user_profiles').delete().eq('user_email', email);

  const userId = await getAuthUserIdByEmail(email);

  const { error: profileError } = await adminClient.from('user_profiles').upsert({
    id: userId,
    user_email: email,
    full_name: fullName,
    status: 'active',
    created_by: email,
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`seedTestUser profile (${email}): ${profileError.message}`);

  const { error: settingsError } = await adminClient.from('user_settings').insert({
    user_email: email,
    mode: 'personal',
    currency: 'USD',
    created_by: email,
  });
  if (settingsError) throw new Error(`seedTestUser settings (${email}): ${settingsError.message}`);

  return userId;
}

export async function deleteTestUser(email) {
  // Only clean DB rows — auth users are permanent and never deleted.
  try {
    await adminClient.from('user_settings').delete().eq('user_email', email);
    await adminClient.from('user_profiles').delete().eq('user_email', email);
  } catch (_) { /* ignore */ }
}

export async function seedCategory(userEmail, name) {
  const { data, error } = await adminClient.from('categories').insert({
    name,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedCategory(${name}): ${error.message}`);
  return data.id;
}

export async function seedBudget(userEmail, categoryId, categoryName, amount = 500) {
  const { data, error } = await adminClient.from('budgets').insert({
    budget_type: 'per_category',
    category_id: categoryId,
    category_name: categoryName,
    amount,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedBudget(${categoryName}): ${error.message}`);
  return data.id;
}

export async function seedRecurringExpense(userEmail, categoryId, categoryName) {
  const { data, error } = await adminClient.from('recurring_expenses').insert({
    name: 'Rent [seeded]',
    amount: 1200,
    frequency: 'monthly',
    start_date: '2026-01-01',
    category_id: categoryId,
    category_name: categoryName,
    is_active: true,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedRecurringExpense: ${error.message}`);
  return data.id;
}

export async function seedSavingsGoal(userEmail) {
  const { data, error } = await adminClient.from('savings_goals').insert({
    name: 'Emergency Fund [seeded]',
    target_amount: 10000,
    current_amount: 0,
    user_email: userEmail,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedSavingsGoal: ${error.message}`);
  return data.id;
}

export async function seedDebt(userEmail) {
  const { data, error } = await adminClient.from('debts').insert({
    from_user_id: userEmail,
    from_user_name: 'QA User A',
    to_user_id: 'external-creditor',
    to_user_name: 'External Creditor',
    amount: 500,
    created_by: userEmail,
  }).select().single();
  if (error) throw new Error(`seedDebt: ${error.message}`);
  return data.id;
}

export async function createHousehold(ownerEmail, memberEmails) {
  // Delete any prior QA household
  await adminClient.from('households').delete()
    .eq('name', 'QA Household')
    .eq('owner_email', ownerEmail);

  const { data, error } = await adminClient.from('households').insert({
    name: 'QA Household',
    owner_email: ownerEmail,
    member_emails: memberEmails,
    invite_code: 'QA-TEST-CODE',
    created_by: ownerEmail,
  }).select().single();
  if (error) throw new Error(`createHousehold: ${error.message}`);
  return data.id;
}

export async function setHouseholdMode(userEmail, householdId) {
  const { error } = await adminClient.from('user_settings')
    .update({ mode: 'household', current_household_id: householdId })
    .eq('user_email', userEmail);
  if (error) throw new Error(`setHouseholdMode(${userEmail}): ${error.message}`);
}
