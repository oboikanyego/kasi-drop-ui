import { test, expect, seed, admin, customer, makePng } from './fixtures.mjs';

const paidOrder = {
  id: 'ord-paid-1',
  items: [
    { productId: 'candle', name: 'African Sunrise Soy Candle', price: 219, quantity: 1, image: '' },
  ],
  subtotal: 219,
  shipping: 79,
  total: 298,
  status: 'paid',
  createdAt: '2026-10-25T10:00:00.000Z',
  delivery: { name: 'Sipho Dlamini', address: '4 Long Street', city: 'Cape Town' },
};
const adminCalls = async (stub) =>
  (await stub.requests()).filter((r) => r.path.startsWith('/api/admin'));

test('customers see the access notice and no admin data is requested', async ({ page, stub }) => {
  await stub.reset({ orders: [paidOrder] });
  await seed(page, { user: customer });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Admin access required.' })).toBeVisible();
  expect(await adminCalls(stub)).toEqual([]);
});

test('the overview shows the summary and recent orders', async ({ page, stub }) => {
  await stub.reset({ orders: [paidOrder] });
  await seed(page, { user: admin });
  await page.goto('/admin');
  const stats = page.locator('.stats-grid');
  await expect(stats).toContainText('Total products2');
  await expect(stats).toContainText('Orders1');
  await expect(page.locator('tbody tr', { hasText: 'Sipho Dlamini' })).toContainText('paid');
});

test('an admin moves a paid order into processing', async ({ page, stub }) => {
  await stub.reset({ orders: [paidOrder] });
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Orders', exact: true }).click();
  const row = page.locator('tbody tr', { hasText: 'Sipho Dlamini' });
  await expect(row.getByRole('button', { name: 'Ship' })).toBeDisabled();
  await row.getByRole('button', { name: 'Process' }).click();

  await expect(page.locator('.success-msg')).toHaveText('Order updated');
  await expect(row).toContainText('processing');
  await expect(row.getByRole('button', { name: 'Ship' })).toBeEnabled();
  const patch = (await adminCalls(stub)).find((r) => r.method === 'PATCH');
  expect(patch).toMatchObject({
    path: '/api/admin/orders/ord-paid-1',
    body: { status: 'processing' },
  });
});

test('an admin publishes a product with its tags split into a list', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Add product' }).click();
  const form = page.locator('.admin-editor form');
  await form.locator('input[name=name]').fill('Beaded Keyring');
  await form.locator('textarea[name=description]').fill('Hand-beaded keyring made in Soweto.');
  await form.locator('input[name=price]').fill('85');
  await form.locator('input[name=stock]').fill('12');
  await form.locator('input[name=tags]').fill('beads,  gift , ');
  await form.locator('input[type=file]').setInputFiles({
    name: 'keyring.png',
    mimeType: 'image/png',
    buffer: makePng(600, 400),
  });
  await expect(form.locator('.photo-preview img')).toBeVisible();
  await form.getByRole('button', { name: /Publish product/ }).click();

  await expect(page.locator('.success-msg')).toHaveText('Product published');
  await expect(page.getByRole('heading', { name: 'Manage products' })).toBeVisible();
  const created = (await adminCalls(stub)).find(
    (r) => r.path === '/api/admin/products' && r.method === 'POST',
  );
  expect(created.method).toBe('POST');
  expect(created.body).toMatchObject({
    name: 'Beaded Keyring',
    description: 'Hand-beaded keyring made in Soweto.',
    category: 'Crafts',
    price: 85,
    stock: 12,
    tags: ['beads', 'gift'],
    image: '/api/images/img-1',
    featured: false,
    active: true,
  });
});

test('an admin saves a stock change', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  const row = page.locator('tbody tr', { hasText: 'African Sunrise Soy Candle' });
  await row.locator('input.stock-input').fill('7');
  await row.getByRole('button', { name: 'Save stock' }).click();

  await expect(page.locator('.success-msg')).toHaveText('Stock updated');
  const patch = (await adminCalls(stub)).find((r) => r.method === 'PATCH');
  expect(patch).toMatchObject({ path: '/api/admin/products/candle', body: { stock: 7 } });
});

test('admin edits an existing product and keeps the original id', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  const product = page.locator('tbody tr', { hasText: 'African Sunrise Soy Candle' });
  await product.getByRole('button', { name: 'Edit African Sunrise Soy Candle' }).click();

  await expect(page.getByRole('heading', { name: 'Edit product listing' })).toBeVisible();
  const form = page.locator('.admin-editor form');
  await expect(form.locator('input[name=name]')).toHaveValue('African Sunrise Soy Candle');
  await expect(form.locator('input[name=price]')).toHaveValue('219');
  await expect(form.locator('.photo-preview img')).toBeVisible();
  await form.locator('input[name=name]').fill('African Sunrise Candle – Large');
  await form
    .locator('textarea[name=description]')
    .fill('A large South African soy candle with warm citrus notes.');
  await form.locator('select[name=category]').selectOption('Crafts');
  await form.locator('input[name=price]').fill('259.95');
  await form.locator('input[name=stock]').fill('7');
  await form.locator('input[name=tags]').fill('soy, handmade, gift');
  await form.locator('input[name=featured]').check();
  await form.locator('input[name=active]').uncheck();
  await form.getByRole('button', { name: 'Save changes' }).click();

  await expect(page.locator('.success-msg')).toContainText('Product updated successfully');
  await expect(page.getByRole('heading', { name: 'Manage products' })).toBeVisible();
  const patch = (await adminCalls(stub)).find(
    (request) =>
      request.method === 'PATCH' &&
      request.path === '/api/admin/products/candle' &&
      request.body?.name === 'African Sunrise Candle – Large',
  );
  expect(patch).toBeTruthy();
  expect(patch.body).toMatchObject({
    name: 'African Sunrise Candle – Large',
    description: 'A large South African soy candle with warm citrus notes.',
    category: 'Crafts',
    price: 259.95,
    stock: 7,
    tags: ['soy', 'handmade', 'gift'],
    featured: true,
    active: false,
    image: '/assets/x.webp',
  });
  await expect(
    page.locator('tbody tr', { hasText: 'African Sunrise Candle – Large' }),
  ).toContainText('Hidden');
  expect(
    (await adminCalls(stub)).filter(
      (request) => request.path === '/api/admin/products' && request.method === 'POST',
    ),
  ).toHaveLength(0);
});

test('admin can replace photo on an existing listing', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Edit African Sunrise Soy Candle' }).click();
  const form = page.locator('.admin-editor form');
  await form.locator('input[type=file]').setInputFiles({
    name: 'new-candle.png',
    mimeType: 'image/png',
    buffer: makePng(600, 400),
  });
  await expect(form.locator('.photo-preview img')).toHaveAttribute('src', /^blob:/);
  await form.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.success-msg')).toContainText('Product updated successfully');
  const patch = (await adminCalls(stub)).find(
    (request) => request.method === 'PATCH' && request.path === '/api/admin/products/candle',
  );
  expect(patch.body.image).toBe('/api/images/img-1');
});

test('cancel editing preserves the original product', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Edit African Sunrise Soy Candle' }).click();
  await page.locator('.admin-editor input[name=name]').fill('Unsaved test changes');
  await page.getByRole('button', { name: 'Cancel editing' }).click();
  await expect(page.getByRole('heading', { name: 'Manage products' })).toBeVisible();
  await expect(page.locator('tbody tr', { hasText: 'African Sunrise Soy Candle' })).toBeVisible();
  expect(
    (await adminCalls(stub)).some(
      (request) => request.method === 'PATCH' && request.path === '/api/admin/products/candle',
    ),
  ).toBe(false);
});
