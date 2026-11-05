import { test, expect, seed, admin } from './fixtures.mjs';

test('admin inventory searches by product name and resets filters', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();

  const search = page.getByRole('searchbox', { name: 'Search products' });
  await search.fill('rooibos');
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('Cape Rooibos Tea Collection');
  await expect(page.getByRole('status')).toContainText('1 matching products');
  expect((await stub.requests()).some(request =>
    request.path === '/api/admin/products' && request.search.includes('q=rooibos'))).toBe(true);

  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('tbody tr')).toHaveCount(2);
});

test('admin combines stock, category, featured, visibility and sort filters', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.locator('#inventory-category').selectOption('Home & Living');
  await page.locator('#inventory-stock').selectOption('available');
  await page.locator('#inventory-featured').selectOption('yes');
  await page.locator('#inventory-sort').selectOption('price-desc');
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(page.locator('tbody tr')).toContainText('African Sunrise Soy Candle');
  await page.locator('#inventory-visibility').selectOption('hidden');
  await expect(page.getByText('No products match your search or filters.')).toBeVisible();
  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  const requests = (await stub.requests()).filter(r=>r.path==='/api/admin/products');
  expect(requests.some(r=>r.search.includes('category=Home') && r.search.includes('stock=available') && r.search.includes('featured=yes'))).toBe(true);
});

test('regular customers never access the inventory search API', async ({ page, stub }) => {
  await stub.reset();
  await page.goto('/shop');
  const response = await page.request.get('/api/admin/products?q=candle');
  expect(response.status()).toBe(401);
});
