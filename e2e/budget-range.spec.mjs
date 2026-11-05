import { test, expect } from './fixtures.mjs';

test('budget stays collapsed until clicked and filters after applying range on mobile', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  const budget = page.getByRole('button', { name: /Any price/ });
  await expect(budget).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Choose a budget range' })).toHaveCount(0);
  await budget.click();
  await expect(page.getByRole('dialog', { name: 'Choose a budget range' })).toBeVisible();
  await expect(budget).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#min-budget-amount').fill('200');
  await page.locator('#max-budget-amount').fill('250');
  // Draft changes must not filter results until Apply range.
  expect(
    (await stub.requests()).some(
      (r) => r.path === '/api/products' && r.search.includes('minPrice=200'),
    ),
  ).toBe(false);
  await page.getByRole('button', { name: 'Apply range' }).click();
  await expect(page.getByRole('dialog', { name: 'Choose a budget range' })).toHaveCount(0);
  await expect(page.getByText('African Sunrise Soy Candle')).toBeVisible();
  await expect(page.getByText('Cape Rooibos Tea Collection')).toHaveCount(0);
  const filtered = (await stub.requests()).filter(
    (r) =>
      r.path === '/api/products' &&
      r.search.includes('minPrice=200') &&
      r.search.includes('maxPrice=250'),
  );
  expect(filtered.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
});

test('desktop popover cancels drafts on backdrop or Escape and supports Reset', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/shop');
  await page.getByRole('button', { name: /Any price/ }).click();
  await page.locator('#min-budget-amount').fill('400');
  await page.getByRole('button', { name: 'Close budget filter' }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Any price/ }).click();
  await expect(page.locator('#min-budget-amount')).toHaveValue('0');
  await page.locator('#max-budget-amount').fill('100');
  await expect(page.locator('#min-budget-amount')).toHaveValue('0');
  await page.getByRole('button', { name: 'Apply range' }).click();
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
  await page.getByRole('button', { name: /R0 – R100/ }).click();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page.locator('#max-budget-amount')).toHaveValue('5000');
  await page.getByRole('button', { name: 'Apply range' }).click();
  await expect(page.getByText('African Sunrise Soy Candle')).toBeVisible();
  await page.getByRole('button', { name: /Any price/ }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('category and sort controls remain alongside Budget', async ({ page, stub }) => {
  await stub.reset();
  await page.goto('/shop');
  await expect(page.getByRole('combobox', { name: 'Filter by category' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Sort products' })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Filter by category' })
    .selectOption({ label: 'Home & Living' });
  await page.getByRole('combobox', { name: 'Sort products' }).selectOption('price-desc');
  expect(
    (await stub.requests()).some(
      (r) => r.path === '/api/products' && r.search.includes('category=Home'),
    ),
  ).toBe(true);
});
