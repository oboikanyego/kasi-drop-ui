import { test, expect, seed, admin, customer, line } from './fixtures.mjs';

test('admin can hide discontinued product and restore it later', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  const row = page.locator('tbody tr', { hasText: 'African Sunrise Soy Candle' });
  await expect(row).toContainText('Visible');
  await row.getByRole('button', { name: 'Hide African Sunrise Soy Candle from store' }).click();
  await expect(row).toContainText('Hidden');
  await expect(page.locator('.success-msg')).toContainText('hidden from shoppers');
  const hideRequest = (await stub.requests()).find(request =>
    request.method === 'PATCH' && request.path === '/api/admin/products/candle' && request.body?.active === false);
  expect(hideRequest).toBeTruthy();

  await page.getByLabel('Filter products by visibility').selectOption('hidden');
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Show African Sunrise Soy Candle in store' }).click();
  await expect(row).toBeHidden();
  await page.getByLabel('Filter products by visibility').selectOption('active');
  await expect(row).toContainText('Visible');
  const restoreRequest = (await stub.requests()).find(request =>
    request.method === 'PATCH' && request.path === '/api/admin/products/candle' && request.body?.active === true);
  expect(restoreRequest).toBeTruthy();
});

test('hidden product disappears from public catalogue and product detail', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Hide African Sunrise Soy Candle from store' }).click();
  await expect(page.locator('tbody tr', { hasText: 'African Sunrise Soy Candle' })).toContainText('Hidden');

  await page.goto('/shop');
  await expect(page.getByText('African Sunrise Soy Candle')).toHaveCount(0);
  await page.goto('/product/candle');
  await expect(page.getByText('Product not found.')).toBeVisible();
});

test('hidden product cannot be purchased from previously saved cart', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Hide African Sunrise Soy Candle from store' }).click();
  // Even an old cart cannot override server-side product visibility.
  const response = await page.request.post('/api/orders/checkout', {
    headers: { 'X-KasiDrop-CSRF': '1' },
    data: {
      items: [{ productId: 'candle', quantity: 1 }],
      paymentMethod: 'demo',
      delivery: { name: 'Tester', phone: '0821111111', address: '123 Main Road', city: 'Johannesburg', province: 'Gauteng', postalCode: '2000' }
    },
  });
  expect(response.status()).toBe(400);
});
