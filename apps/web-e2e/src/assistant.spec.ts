import { randomUUID } from 'node:crypto';
import { Page } from '@playwright/test';
import { expect, test } from './support/fixtures';

/** Letters only: the assistant ignores all-digit words, and a hex id is sometimes all digits. */
const searchableWord = (): string =>
  'zq' + randomUUID().replace(/-/g, '').slice(0, 10).replace(/[0-9]/g, (digit) => String.fromCharCode(97 + Number(digit)));

const openAssistant = async (page: Page) => {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Assistant' }).click();
  return page.getByRole('complementary', { name: 'Shopping assistant' });
};

test.describe('assistant side panel (microfrontend)', () => {
  test('answers from the catalog on any page and hands the selected product back to the host', async ({ page, adminApi }) => {
    const token = searchableWord();
    const product = await adminApi.createProduct({ stock: 4, price: 37, name: `E2E Assistant Kettle ${token}` });

    await page.goto('/cart');
    const panel = await openAssistant(page);
    // The widget lives in a separately built bundle and renders inside a shadow root; Playwright locators pierce it.
    const assistant = panel.locator('shop-assistant');
    const question = assistant.getByLabel('Your question');
    await question.fill(`Is there a ${token} kettle under $50?`);
    await assistant.getByRole('button', { name: 'Send' }).click();

    const suggestions = assistant.getByRole('list', { name: 'Suggested products' });
    const first = suggestions.first().getByRole('listitem').first();
    await expect(first).toContainText(product.name);
    await expect(first).toContainText('$37.00');
    await expect(first).toContainText('In stock');

    // A follow-up without product words is answered from the products shown before; Enter sends it.
    await question.fill('Which of them is in stock?');
    await question.press('Enter');
    await expect(assistant.getByTestId('assistant-question')).toHaveCount(2);
    await expect(suggestions).toHaveCount(2);
    const followUp = suggestions.last().getByRole('listitem').first();
    await expect(followUp).toContainText(product.name);

    await followUp.getByRole('button', { name: `View ${product.name}` }).click();
    await expect(page).toHaveURL(new RegExp(`/products/${product.slug}$`));
    await expect(page.getByRole('heading', { level: 1, name: product.name })).toBeVisible();
    // Wide viewport: the panel stays open next to the page and keeps the whole conversation.
    await expect(assistant.getByTestId('assistant-question')).toHaveCount(2);
    await expect(first).toContainText(product.name);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('button', { name: 'Assistant' })).toBeFocused();
  });

  test('the shop keeps working when the microfrontend cannot be loaded', async ({ page }) => {
    await page.route('**/mfe/assistant/**', (route) => route.abort());

    await page.goto('/');
    const panel = await openAssistant(page);
    await expect(panel.getByRole('alert')).toContainText('The assistant is unavailable');

    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Catalog', exact: true }).click();
    await expect(page.getByTestId('result-count')).toContainText('products found');
  });
});
