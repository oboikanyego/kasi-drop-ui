import { defineConfig } from '@playwright/test';

// Browser tests drive the production build against e2e/stub-server.mjs (run `npm run build` first).
export default defineConfig({
  testDir: 'e2e',
  // The stub API keeps one shared state, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  timeout: 60_000,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4310', trace: 'retain-on-failure' },
  webServer: {
    command: 'node e2e/stub-server.mjs',
    url: 'http://localhost:4310/__stub/health',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
