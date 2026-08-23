import { defineConfig, devices } from '@playwright/test';

const e2eEnv = {
  VITE_GOOGLE_CLIENT_ID: 'playwright-google-client',
  VITE_ALBUM_API_URL: 'http://localhost:4002',
  VITE_AUTH_SERVICE_URL: 'http://localhost:5001',
  VITE_AUTH_FRONT_URL: 'http://localhost:3004',
  VITE_FINANCE_API_URL: 'http://localhost:4003',
  VITE_RELATIONSHIP_FRONT_URL: 'http://localhost:3001',
  VITE_ALBUM_FRONT_URL: 'http://localhost:3002',
  VITE_FINANCE_FRONT_URL: 'http://localhost:3003',
  VITE_RELATIONSHIP_API_URL: 'http://localhost:4001',
  VITE_PUBLIC_API_URL: 'http://localhost:5003',
  VITE_PAYMENT_FRONT_URL: 'http://localhost:3005',
  VITE_PAYMENT_API_URL: 'http://localhost:5005',
  VITE_GROUP_FRONT_URL: 'http://localhost:3006',
  VITE_GROUP_API_URL: 'http://localhost:5006',
  VITE_ACCOUNT_FRONT_URL: 'http://localhost:3007',
  VITE_SHELL_FRONT_URL: 'http://localhost:3000',
  VITE_SEGMENTATION_API_URL: 'http://localhost:8001',
  VITE_OBJECT_DETECTION_API_URL: 'http://localhost:8002'
};

export default defineConfig({
  testDir: './e2e',
  // Warms every dev server so a cold Vite compile is not charged to the first
  // test's timeout. See e2e/globalSetup.ts.
  globalSetup: './e2e/globalSetup.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: process.env.CI ? [['dot'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: process.env.E2E_WEB_SERVER_COMMAND || 'npm run dev:front',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: e2eEnv
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
