// tests/qa/global-teardown.js
import { deleteTestUser, adminClient } from './helpers/supabase-admin.js';

export default async function globalTeardown() {
  console.log('[teardown] Removing test accounts...');
  await Promise.all([
    deleteTestUser('qa-user-a@budgetmate.test'),
    deleteTestUser('qa-user-b@budgetmate.test'),
    deleteTestUser('qa-user-c@budgetmate.test'),
  ]);
  await adminClient.from('households').delete().eq('name', 'QA Household');
  console.log('[teardown] Done.');
}
