import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1,
  use: { headless: true, viewport: { width: 400, height: 900 }, screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview:test', url: 'http://localhost:4173', reuseExistingServer: !process.env.CI },
});
