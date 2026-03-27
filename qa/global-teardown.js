// tests/qa/global-teardown.js
import { deleteTestUser, adminClient } from './helpers/supabase-admin.js';
import path from 'path';
import os from 'os';
import fs from 'fs';

export default async function globalTeardown() {
  console.log('[teardown] Removing test accounts...');
  await Promise.all([
    deleteTestUser('qa-user-a@budgetmate.test'),
    deleteTestUser('qa-user-b@budgetmate.test'),
    deleteTestUser('qa-user-c@budgetmate.test'),
  ]);
  await adminClient.from('households').delete().eq('name', 'QA Household');

  // Clean up tmp session + setup signal so a re-run within 10 min triggers a fresh setup
  const sessionFile = path.join(os.tmpdir(), 'qa-session.json');
  const setupSignal = path.join(os.tmpdir(), 'qa-signal-setup.json');
  for (const f of [sessionFile, setupSignal]) {
    try { fs.unlinkSync(f); } catch (_) {}
  }
  console.log('[teardown] Cleaned up tmp session files.');

  console.log('[teardown] Done.');
}
