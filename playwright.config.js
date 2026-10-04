import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  timeout: 30_000,
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npm run start',
    url: 'http://127.0.0.1:4173/web/',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
