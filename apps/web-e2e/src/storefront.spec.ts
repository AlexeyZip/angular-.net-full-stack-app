import { unique } from './support/api';
import { expect, searchCatalog, test } from './support/fixtures';

test.describe('storefront', () => {
  test('runs the state-management variant this project targets', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByTestId('state-variant')).toHaveText(testInfo.project.name === 'ngrx' ? 'State: NgRx' : 'State: Signals');
  });

  test('journey 1: browse the catalog with pagination', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByTestId('result-count')).toContainText('products found');
    const firstPage = await page.getByTestId('product-card').count();
    expect(firstPage).toBe(12);

    await page.getByRole('button', { name: '2', exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  });

  test('journey 2: search and filter products, with an empty result', async ({ page, adminApi }) => {
    const name = unique('E2E Searchable Lamp');
    await adminApi.createProduct({ stock: 3, price: 42, name });

    await searchCatalog(page, name);
    await expect(page.getByTestId('product-card')).toHaveCount(1);
    await expect(page.getByRole('article', { name })).toContainText('$42.00');

    // Narrowing the price range below the product price filters it out and offers a reset.
    await page.getByLabel('Maximum price').fill('10');
    await page.getByLabel('Maximum price').blur();
    await expect(page).toHaveURL(/maxPrice=10/);
    await expect(page.getByRole('heading', { name: 'No products match your filters' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear filters' }).first().click();
    await expect(page).not.toHaveURL(/maxPrice/);
    await expect(page.getByTestId('result-count')).toContainText('products found');
  });

  test('journey 2b: sorting by price is applied by the server', async ({ page }) => {
    await page.goto('/products?sort=PriceAsc');
    await expect(page.getByTestId('product-card').first()).toBeVisible();
    const prices = await page.getByTestId('product-price').allTextContents();
    const values = prices.map((text) => Number(text.replace(/[^0-9.]/g, '')));
    expect(values.length).toBeGreaterThan(1);
    expect(values).toEqual([...values].sort((a, b) => a - b));
  });

  test('journey 3: open a product detail page, including the deferred reviews', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 2, price: 19.5 });

    await searchCatalog(page, product.name);
    await page.getByRole('link', { name: product.name }).click();

    await expect(page).toHaveURL(new RegExp(`/products/${product.slug}$`));
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    await expect(page.getByTestId('stock-status')).toContainText('Only 2 left');

    // Reviews are an @defer (on viewport) block. Depending on the window height the placeholder is already in view
    // (and replaced) or below the fold, so scroll to the end instead of targeting the placeholder.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.getByRole('heading', { name: 'Customer reviews' })).toBeVisible();
    await expect(page.getByText('No reviews yet.')).toBeVisible();
  });

  test('the wishlist is optimistic in the UI and persisted on the server', async ({ page, customer, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 5 });
    await searchCatalog(page, product.name);
    const saved = page.waitForResponse((r) => r.url().includes(`/api/wishlist/${product.id}`) && r.request().method() === 'PUT');
    await page.getByRole('button', { name: `Save ${product.name} to wishlist` }).click();
    // The count updates optimistically, before the server confirms.
    await expect(page.getByTestId('wishlist-count')).toHaveText('1');
    expect((await saved).status()).toBe(204);

    await page.reload();
    await expect(page.getByRole('link', { name: customer.fullName })).toBeVisible();
    await page.getByRole('link', { name: /Wishlist/ }).click();
    await expect(page.getByRole('article', { name: product.name })).toBeVisible();
  });

  test('a guest who tries to save to the wishlist is asked to sign in', async ({ page, adminApi }) => {
    const product = await adminApi.createProduct({ stock: 5 });
    await searchCatalog(page, product.name);
    await page.getByRole('button', { name: `Save ${product.name} to wishlist` }).click();
    await expect(page).toHaveURL(/\/login\?returnUrl=/);
  });

  test('an unknown product shows a not-found state, not a crash', async ({ page }) => {
    await page.goto('/products/this-product-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Product not found' })).toBeVisible();
  });
});
