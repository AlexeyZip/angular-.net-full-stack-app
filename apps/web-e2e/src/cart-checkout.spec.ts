import { Page } from '@playwright/test';
import { Customer } from './support/api';
import { addToCartFromCatalog, expect, test } from './support/fixtures';

async function fillAddress(page: Page, customer: Customer): Promise<void> {
  // The recipient is pre-filled from the signed-in profile.
  await expect(page.getByLabel('Full name')).toHaveValue(customer.fullName);
  await page.getByRole('textbox', { name: 'Address' }).fill('1 Test Street');
  await page.getByLabel('City').fill('Testville');
  await page.getByLabel('Postal code').fill('12345');
}

test.describe('cart and checkout', () => {
  test('journeys 4-8: add to cart, update quantity, check out, verify the order and the history', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 10, price: 40 });

    // 4. Add a product to the cart.
    await addToCartFromCatalog(page, product.name);
    await expect(page.getByTestId('cart-count')).toHaveText('1');

    // 5. Update the quantity; totals are recalculated by the server.
    await page.getByRole('link', { name: 'Cart, 1 items' }).click();
    await expect(page.getByTestId('summary-total')).toHaveText('$49.99'); // 40 + 9.99 shipping
    const increase = page.getByRole('button', { name: `Increase quantity of ${product.name}` });
    await increase.click();
    await increase.click();
    await expect(page.getByTestId('cart-count')).toHaveText('3');
    await expect(page.getByTestId('summary-shipping')).toHaveText('Free'); // 120 >= 100
    await expect(page.getByTestId('summary-total')).toHaveText('$120.00');

    // 6. Check out with the payment simulator.
    await page.getByTestId('checkout-button').click();
    await expect(page).toHaveURL(/\/checkout$/);
    await fillAddress(page, customer);
    await page.getByTestId('place-order').click();

    // 7. The created order shows the server-calculated total.
    await expect(page).toHaveURL(/\/orders\/[0-9a-f-]{36}\?placed=1$/);
    await expect(page.getByTestId('order-placed')).toBeVisible();
    await expect(page.getByTestId('order-total')).toHaveText('$120.00');
    await expect(page.getByTestId('order-status')).toHaveText('Paid');
    await expect(page.getByTestId('cart-count')).toHaveText('0');
    const orderNumber = (await page.getByRole('heading', { level: 1 }).textContent())?.replace('Order ', '').trim() ?? '';
    expect(orderNumber).toMatch(/^SO-\d{8}-[A-Z0-9]{8}$/);

    // 8. Order history lists it.
    await page.getByRole('link', { name: 'Orders', exact: true }).click();
    await expect(page.getByTestId('order-row').filter({ hasText: orderNumber })).toContainText('$120.00');
  });

  test('a customer can cancel a paid order and the stock is returned', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 1, price: 15 });

    await addToCartFromCatalog(page, product.name);
    await page.goto('/checkout');
    await fillAddress(page, customer);
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('order-status')).toHaveText('Paid');

    await page.getByRole('button', { name: 'Cancel order' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel order' }).click();
    await expect(page.getByTestId('order-status')).toHaveText('Cancelled');

    await page.goto(`/products/${product.slug}`);
    await expect(page.getByTestId('stock-status')).toContainText('Only 1 left');
  });

  test('failure path: invalid checkout input is rejected before anything is sent', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 5 });
    await addToCartFromCatalog(page, product.name);
    await page.goto('/checkout');
    await expect(page.getByLabel('Full name')).toHaveValue(customer.fullName);

    let checkoutRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/orders')) {
        checkoutRequests++;
      }
    });

    await page.getByLabel('Full name').fill('');
    await page.getByTestId('place-order').click();

    await expect(page.locator('#recipient-error')).toHaveText('This field is required.');
    await expect(page.locator('#line1-error')).toHaveText('This field is required.');
    expect(checkoutRequests).toBe(0);
  });

  test('failure path: a declined payment keeps the cart and explains what happened', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 5 });
    await addToCartFromCatalog(page, product.name);
    await page.goto('/checkout');
    await fillAddress(page, customer);

    await page.getByLabel('Test card – declined').check();
    await page.getByTestId('place-order').click();

    await expect(page.getByTestId('checkout-error')).toContainText('Payment declined.');
    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('failure path: stock sold out between quote and order is reported, not oversold', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 1 });
    await addToCartFromCatalog(page, product.name);
    await page.goto('/checkout');
    await fillAddress(page, customer);
    await expect(page.getByTestId('place-order')).toBeEnabled();

    await adminApi.adjustStock(product.id, -1); // someone else bought the last unit

    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('checkout-error')).toContainText('no longer available');
    await expect(page.getByTestId('place-order')).toBeDisabled(); // the refreshed quote blocks checkout
  });

  test('a guest is sent to sign in before checkout and keeps the cart afterwards', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 5 });
    await addToCartFromCatalog(page, product.name);

    await page.goto('/checkout');
    await expect(page).toHaveURL(/\/login\?returnUrl=(%2F|\/)checkout$/);

    // Registering from here merges the guest cart into the new account and returns to checkout.
    await page.getByRole('link', { name: 'Create an account' }).click();
    const id = Date.now().toString(36);
    await page.getByLabel('Full name').fill('Returning Guest');
    await page.getByLabel('Email').fill(`guest-${id}@test.local`);
    await page.getByLabel('Password', { exact: true }).fill('E2e-Password-123');
    await page.getByLabel('Confirm password').fill('E2e-Password-123');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/checkout$/);
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });
});
