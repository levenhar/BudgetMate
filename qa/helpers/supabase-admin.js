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
 * Paginate through ALL pages of listUsers to find a user by email.
 * The SDK's listUsers({ perPage: 1000 }) only returns page 1 — projects with
 * >1000 users (or soft-deleted users on later pages) would not be found otherwise.
 */
async function findUserByEmail(email) {
  let page = 1;
  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find(u => u.email === email);
    if (found) return found;
    // nextPage is present in newer SDK versions; fall back to counting returned users
    // to detect whether there are more pages.
    if (data?.nextPage) {
      page = data.nextPage;
    } else if (users.length === 1000) {
      page++; // full page returned — there may be more
    } else {
      return null; // partial page = last page
    }
  }
}

/**
 * Fallback: scan all users via the raw Supabase Admin Auth REST API.
 * The JS SDK's listUsers may omit soft-deleted (tombstoned) users in some Supabase
 * versions; the raw endpoint includes them. Paginates until found or exhausted.
 */
async function fetchUserByEmailDirect(email) {
  try {
    let page = 1;
    while (true) {
      const url = `${SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=1000`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          apikey: SERVICE_ROLE_KEY,
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      const users = json?.users ?? [];
      const found = users.find(u => u.email === email);
      if (found) return found;
      // GoTrue returns `next_page` (snake_case) in the raw REST response
      if (!json.next_page || users.length < 1000) return null;
      page = json.next_page;
    }
  } catch {
    return null;
  }
}

export async function createTestUser(email, password, fullName) {
  // Pre-cleanup: remove any leftover DB rows for this email
  await adminClient.from('user_settings').delete().eq('user_email', email);
  await adminClient.from('user_profiles').delete().eq('user_email', email);

  // Find existing auth user across ALL pages (not just page 1)
  const existing = await findUserByEmail(email);

  let userId;
  if (existing) {
    // Update existing user (handles both active and soft-deleted users)
    const { data, error } = await adminClient.auth.admin.updateUser(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) throw new Error(`createTestUser update(${email}): ${error.message}`);
    userId = data.user.id;
  } else {
    const { data, error } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error?.message?.includes('already been registered') || error?.message?.includes('already registered')) {
      // listUsers didn't return the user but Supabase knows it exists.
      // This happens when a user is soft-deleted and the SDK filters them out.
      // Try the raw REST endpoint which returns soft-deleted records too.
      const tombstoned = await fetchUserByEmailDirect(email);
      if (!tombstoned) {
        throw new Error(
          `createTestUser(${email}): email is permanently tombstoned in Supabase.\n` +
          `Go to Supabase Dashboard → Authentication → Users, restore or remove the deleted record,\n` +
          `or change USER_A/USER_B/USER_C in global-setup.js + QA_USERS in auth.js to fresh addresses.`
        );
      }
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUser(tombstoned.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (updateErr) throw new Error(`createTestUser resurrect(${email}): ${updateErr.message}`);
      userId = updated.user.id;
    } else if (error) {
      throw new Error(`createTestUser(${email}): ${error.message}`);
    } else {
      userId = data.user.id;
    }
  }

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
  // Only clean up DB rows — do NOT delete auth users.
  // Supabase tombstones deleted emails, preventing re-creation in subsequent runs.
  // Auth users are reused across runs via updateUser in createTestUser.
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
