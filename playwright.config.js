import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    headless: false,   // headed so you can type your password
    slowMo: 500,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        channel: 'chrome',
        args: ['--disable-blink-features=AutomationControlled'],
      },
    },
  ],
});
