import { test, expect } from './fixtures.mjs';

test('shop range picker filters products between two amounts', async ({ page, stub }) => {
  await stub.reset();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/shop');
  await expect(page.getByRole('group', { name: 'Budget range' })).toBeVisible();
  await page.locator('#min-budget-amount').fill('200');
  await page.locator('#min-budget-amount').press('Tab');
  await page.locator('#max-budget-amount').fill('250');
  await page.locator('#max-budget-amount').press('Tab');
  await expect(page.getByText('African Sunrise Soy Candle')).toBeVisible();
  await expect(page.getByText('Cape Rooibos Tea Collection')).toHaveCount(0);
  const filtered = (await stub.requests()).filter(r => r.path === '/api/products' && r.search.includes('minPrice=200') && r.search.includes('maxPrice=250'));
  expect(filtered.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
test('range handles crossing bounds and resets filters', async ({ page, stub }) => {
  await stub.reset();
  await page.goto('/shop');
  await page.locator('#min-budget-amount').fill('400');
  await page.locator('#min-budget-amount').press('Tab');
  await expect(page.locator('#max-budget-amount')).toHaveValue('5000');
  await page.locator('#max-budget-amount').fill('100');
  await page.locator('#max-budget-amount').press('Tab');
  await expect(page.locator('#min-budget-amount')).toHaveValue('100');
  await expect(page.getByRole('heading', { name: 'No products found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.locator('#min-budget-amount')).toHaveValue('0');
  await expect(page.locator('#max-budget-amount')).toHaveValue('5000');
});
