// qa/playwright.config.js
import { defineConfig } from '@playwright/test';
import { readFileSync } from 'fs';
import path from 'path';

// Load .env.local so SUPABASE_SERVICE_ROLE_KEY is available to global-setup/teardown
try {
  const envPath = path.resolve(import.meta.dirname, '../.env.local');
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx);
      const val = trimmed.slice(idx + 1);
      if (!process.env[key]) process.env[key] = val;
    }
  });
} catch { /* .env.local is optional */ }

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.js',
  globalTeardown: './global-teardown.js',

  use: {
    headless: true,
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 20000,
  },

  // Each worker gets its own browser. 10 agents → up to 10 parallel workers.
  workers: process.env.CI ? 5 : 3, // CI: 5 parallel; local: 3

  projects: [
    { name: 'expenses',    testMatch: 'expenses.spec.js' },
    { name: 'budget',      testMatch: 'budget.spec.js' },
    { name: 'goals',       testMatch: 'goals.spec.js' },
    { name: 'debts',       testMatch: 'debts.spec.js' },
    { name: 'recurring',   testMatch: 'recurring.spec.js' },
    { name: 'statistics',  testMatch: 'statistics.spec.js' },
    {
      name: 'settings',
      testMatch: 'settings.spec.js',
      // Settings must run after all 6 above complete
      dependencies: ['expenses', 'budget', 'goals', 'debts', 'recurring', 'statistics'],
    },
    { name: 'shared-a',    testMatch: 'shared-a.spec.js' },
    { name: 'shared-b',    testMatch: 'shared-b.spec.js' },
    { name: 'shared-c',    testMatch: 'shared-c.spec.js' },
  ],

  outputDir: '../test-results/qa',
  reporter: [
    ['list'],
    ['html', { outputFolder: '../playwright-report/qa', open: 'never' }],
  ],
});
