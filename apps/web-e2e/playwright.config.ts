import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run the REAL stack: Angular dev server -> ASP.NET Core API -> PostgreSQL.
 * Prerequisite: PostgreSQL is running (`docker compose up -d postgres`). Playwright starts the API, both
 * Angular variants and the assistant microfrontend itself, or reuses ones that are already running locally.
 *
 * Every test runs twice - once per state-management variant - against the same backend.
 */
const API_URL = process.env['E2E_API_URL'] ?? 'http://localhost:5080';
const SIGNALS_URL = process.env['E2E_SIGNALS_URL'] ?? 'http://localhost:4200';
const NGRX_URL = process.env['E2E_NGRX_URL'] ?? 'http://localhost:4300';
/** The assistant microfrontend; both hosts proxy /mfe/assistant/ to it. */
const ASSISTANT_MFE_URL = process.env['E2E_ASSISTANT_MFE_URL'] ?? 'http://localhost:4400/mfe/assistant/main.js';
const isCI = !!process.env['CI'];

export default defineConfig({
  testDir: './src',
  outputDir: '../../dist/.playwright/web-e2e/test-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Playwright's default (half the cores) starves the two Angular dev servers and the API on a developer machine:
  // requests then exceed the 10 s expect timeout and random journeys fail. Two workers were also the fastest run.
  workers: Number(process.env['E2E_WORKERS'] ?? 2),
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
        RateLimiting__AssistantPermitLimit: '10000',
      },
    },
    {
      command: 'npx nx serve assistant-mfe',
      cwd: '../..',
      url: ASSISTANT_MFE_URL,
      reuseExistingServer: !isCI,
      timeout: 180_000,
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
