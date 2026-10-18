import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the REAL stack: Angular dev server -> ASP.NET Core API -> PostgreSQL.
 * Prerequisite: PostgreSQL is running (`docker compose up -d postgres`). Playwright starts the API and
 * both Angular variants itself, or reuses ones that are already running locally.
 *
 * Every test runs twice - once per state-management variant - against the same backend.
 */
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5080';
const SIGNALS_URL = process.env['E2E_SIGNALS_URL'] ?? 'http://localhost:4200';
const NGRX_URL = process.env['E2E_NGRX_URL'] ?? 'http://localhost:4300';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './src',
  outputDir: '../../dist/.playwright/web-e2e/test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI ? [['list'], ['html', { outputFolder: '../../dist/.playwright/web-e2e/report', open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'signals', use: { ...devices['Desktop Chrome'], baseURL: SIGNALS_URL } },
    { name: 'ngrx', use: { ...devices['Desktop Chrome'], baseURL: NGRX_URL } },
  ],
  webServer: [
    {
      command: 'dotnet run --project services/api/src/Shop.Api --launch-profile http',
      cwd: '../..',
      url: `${API_URL}/health/ready`,
      reuseExistingServer: !isCI,
      timeout: 180_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        // Many tests sign in; the production-like per-IP limit would throttle the suite.
        RateLimiting__AuthPermitLimit: '10000',
        RateLimiting__CheckoutPermitLimit: '10000',
      },
    },
    {
      command: 'npx nx serve web --configuration=development',
      cwd: '../..',
      url: SIGNALS_URL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
    {
      command: 'npx nx serve web --configuration=development-ngrx',
      cwd: '../..',
      url: NGRX_URL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
    },
  ],
});
