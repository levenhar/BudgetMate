import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './qa/specs',
  use: {
    headless: false,
    baseURL: 'http://localhost:5177',
  },
  projects: [{ name: 'chrome', use: { channel: 'chrome' } }],
});
