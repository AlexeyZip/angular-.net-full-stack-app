import { placeOrderAsNewCustomer, unique } from './support/api';
import { expect, signIn, signInAsAdmin, test } from './support/fixtures';

test.describe('administration', () => {
  test('journey 9: an administrator signs in and reaches the dashboard', async ({ page }) => {
    await signInAsAdmin(page);
    await page.getByRole('link', { name: 'Admin', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible();
    await expect(page.getByTestId('kpi-orders')).toHaveText(/^\d+$/);
  });

  test('journeys 10-11: create and edit a product, then update its inventory', async ({ page }) => {
    const name = unique('E2E Admin Kettle');
    await signInAsAdmin(page);

    // 10a. Create
    await page.goto('/admin/products');
    await page.getByRole('link', { name: 'New product' }).click();
    await page.getByLabel('Name', { exact: true }).fill(name);
    await page.getByLabel('Brand').fill('E2E Brand');
    await page.getByLabel('Price (USD)').fill('55.5');
    await page.getByLabel('Category').selectOption({ index: 1 });
    await page.getByLabel('Description').fill('A kettle created through the admin UI.');
    await page.getByLabel('Initial stock').fill('4');
    await page.getByRole('button', { name: 'Create product' }).click();

    await expect(page).toHaveURL(/\/admin\/products\/\d+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Edit product' })).toBeVisible();
    await expect(page.getByTestId('stock-quantity')).toHaveText('4');

    // 10b. Edit
    await page.getByLabel('Price (USD)').fill('49.99');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.getByText('Product saved.')).toBeVisible();

    // 11. Inventory
    await page.getByLabel('Adjustment (+ receive, − write off)').fill('6');
    await page.getByLabel('Reason').fill('Delivery received');
    await page.getByRole('button', { name: 'Apply adjustment' }).click();
    await expect(page.getByTestId('stock-quantity')).toHaveText('10');

    // The storefront reflects the edit and the new stock.
    await page.goto(`/products?search=${encodeURIComponent(name)}`);
    const card = page.getByRole('article', { name });
    await expect(card.getByTestId('product-price')).toHaveText('$49.99');
    await card.getByRole('link', { name }).click();
    await expect(page.getByTestId('stock-status')).toHaveText('In stock');

    // Every admin change is audited.
    await page.goto('/admin/audit-log');
    await expect(page.getByTestId('audit-row').first()).toBeVisible();
  });

  test('failure path: invalid product input is rejected with field errors', async ({ page }) => {
    await signInAsAdmin(page);
    await page.goto('/admin/products/new');
    await page.getByLabel('Price (USD)').fill('1.999');
    await page.getByRole('button', { name: 'Create product' }).click();

    await expect(page.locator('#name-error')).toHaveText('This field is required.');
    await expect(page.locator('#price-error')).toHaveText('Use at most two decimal places.');
    await expect(page.locator('#category-error')).toHaveText('Select a category.');
    await expect(page).toHaveURL(/\/admin\/products\/new$/);
  });

  test('failure path: stock cannot be written off below zero', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 2 });
    await signInAsAdmin(page);
    await page.goto(`/admin/products/${product.id}`);

    await page.getByLabel('Adjustment (+ receive, − write off)').fill('-5');
    await page.getByLabel('Reason').fill('Damaged in storage');
    await page.getByRole('button', { name: 'Apply adjustment' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /stock/i })).toBeVisible();
    await expect(page.getByTestId('stock-quantity')).toHaveText('2');
  });

  test('journey 12: change an order status through the allowed transitions', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 3 });
    const order = await placeOrderAsNewCustomer(product.id);

    await signInAsAdmin(page);
    await page.goto('/admin/orders');
    await page.getByLabel('Search orders').fill(order.orderNumber);
    // The search is debounced; wait for the filtered result so the click does not race a re-render.
    await expect(page.getByTestId('order-status')).toHaveCount(1);
    await page.getByRole('link', { name: order.orderNumber }).click();

    // The list stays rendered until the lazy detail route has loaded.
    await expect(page.getByRole('heading', { level: 1, name: `Order ${order.orderNumber}` })).toBeVisible();
    await expect(page.getByTestId('order-status')).toHaveText('Paid');
    await page.getByRole('button', { name: 'Mark as shipped' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('Shipped');

    // A shipped order can no longer be cancelled; the UI offers only what the state machine allows.
    await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Mark as delivered' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('Delivered');
    await expect(page.getByText('This order is in a final state.')).toBeVisible();
  });
});

test.describe('access control (journey 13)', () => {
  test('an anonymous visitor is sent to sign in', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
    await expect(page.getByRole('heading', { name: 'Products' })).toHaveCount(0);
  });

  test('a signed-in customer cannot open the admin area', async ({ page, customer }) => {
    await expect(page.getByRole('link', { name: customer.fullName })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);

    await page.goto('/admin');
    await expect(page).not.toHaveURL(/\/admin/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toHaveCount(0);
  });

  test('the API itself rejects non-admin callers, whatever the UI does', async ({ page, customer }) => {
    // The page context shares the customer's refresh cookie; exchange it for an access token.
    const refreshed = await page.request.post('/api/auth/refresh', { headers: { 'X-Shop-Client': 'web' } });
    expect(refreshed.ok(), `refresh failed for ${customer.email}`).toBe(true);
    const { accessToken } = (await refreshed.json()) as { accessToken: string };

    const asCustomer = await page.request.get('/api/admin/dashboard', { headers: { Authorization: `Bearer ${accessToken}` } });
    expect(asCustomer.status()).toBe(403);

    const anonymous = await page.request.get('/api/admin/dashboard');
    expect(anonymous.status()).toBe(401);
  });

  test('wrong credentials show an error and do not sign in', async ({ page }) => {
    await signIn(page, 'admin@shop.local', 'definitely-wrong-123');
    await expect(page.getByTestId('login-error')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
});
