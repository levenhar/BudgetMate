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

async function deleteAuthUserByEmail(email) {
  try {
    const { data } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (data?.users) {
      const existing = data.users.find(u => u.email === email);
      if (existing) await adminClient.auth.admin.deleteUser(existing.id);
    }
  } catch (_) { /* ignore */ }
}

export async function createTestUser(email, password, fullName) {
  // Pre-cleanup: remove any leftover DB rows and auth user for this email
  await adminClient.from('user_settings').delete().eq('user_email', email);
  await adminClient.from('user_profiles').delete().eq('user_email', email);
  await deleteAuthUserByEmail(email);

  // Create new auth user
  let { data, error } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  // If "already registered", force-delete and retry once
  if (error?.message?.includes('already been registered') || error?.message?.includes('already registered')) {
    await deleteAuthUserByEmail(email);
    await new Promise(r => setTimeout(r, 500));
    ({ data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }));
  }

  if (error) throw new Error(`createTestUser(${email}): ${error.message}`);

  const userId = data.user.id;

  const { error: profileError } = await adminClient.from('user_profiles').upsert({
    id: userId,
    user_email: email,
    full_name: fullName,
    status: 'active',
    created_by: email,
  }, { onConflict: 'id' });
  if (profileError) throw new Error(`createTestUser profile upsert (${email}): ${profileError.message}`);

  await adminClient.from('user_settings').delete().eq('user_email', email);
  const { error: settingsError } = await adminClient.from('user_settings').insert({
    user_email: email,
    mode: 'personal',
    currency: 'USD',
    created_by: email,
  });
  if (settingsError) throw new Error(`createTestUser settings insert (${email}): ${settingsError.message}`);

  return userId;
}

export async function deleteTestUser(email) {
  try {
    const { data, error } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (error || !data?.users) return;
    const user = data.users.find(u => u.email === email);
    if (user) await adminClient.auth.admin.deleteUser(user.id);
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
