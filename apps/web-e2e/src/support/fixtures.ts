import { expect, Page, test as base } from '@playwright/test';
import { ADMIN, AdminApi, Customer, newCustomer } from './api';

interface Fixtures {
  /** A freshly registered customer, signed in in the browser. */
  customer: Customer;
  /** Admin API client for arranging data (products, stock). */
  adminApi: AdminApi;
}

export const test = base.extend<Fixtures>({
  customer: async ({ page }, use) => {
    const customer = newCustomer();
    await page.goto('/register');
    await page.getByLabel('Full name').fill(customer.fullName);
    await page.getByLabel('Email').fill(customer.email);
    await page.getByLabel('Password', { exact: true }).fill(customer.password);
    await page.getByLabel('Confirm password').fill(customer.password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('link', { name: customer.fullName })).toBeVisible();
    await use(customer);
  },
  adminApi: async ({}, use) => {
    const api = await AdminApi.signIn();
    await use(api);
    await api.dispose();
  },
});

export { expect };

export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function signInAsAdmin(page: Page): Promise<void> {
  await signIn(page, ADMIN.email, ADMIN.password);
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toBeVisible();
}

export async function searchCatalog(page: Page, term: string): Promise<void> {
  await page.goto(`/products?search=${encodeURIComponent(term)}`);
}

export async function addToCartFromCatalog(page: Page, productName: string): Promise<void> {
  await searchCatalog(page, productName);
  const card = page.getByRole('article', { name: productName });
  await card.getByRole('button', { name: 'Add to cart' }).click();
}
