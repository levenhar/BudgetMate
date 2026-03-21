// tests/qa/global-teardown.js
import { deleteTestUser, adminClient } from './helpers/supabase-admin.js';

export default async function globalTeardown() {
  console.log('[teardown] Removing test accounts...');
  await Promise.all([
    deleteTestUser('qa-user-a@budgetmate.local'),
    deleteTestUser('qa-user-b@budgetmate.local'),
    deleteTestUser('qa-user-c@budgetmate.local'),
  ]);
  await adminClient.from('households').delete().eq('name', 'QA Household');
  console.log('[teardown] Done.');
}
