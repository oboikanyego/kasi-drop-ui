import { test, expect, seed, customer, line, storedCart } from './fixtures.mjs';

test('demo checkout sends the bag and saved address, then clears the purchased items', async ({
  page,
  stub,
}) => {
  await stub.reset({ demoMode: true });
  await seed(page, { user: customer, cart: [line('candle', 2), line('rooibos-tea', 1)] });
  await page.goto('/checkout');
  // The default saved address pre-fills the delivery form.
  await expect(page.locator('input[name=address]')).toHaveValue('Flat 3, 12 Vilakazi Street');
  await page.getByRole('button', { name: /Place demo order/ }).click();

  await expect(page).toHaveURL(/\/orders$/);
  const checkout = (await stub.requests()).find((r) => r.path === '/api/orders/checkout');
  expect(checkout.auth).toBe('Bearer e2e-token');
  expect(checkout.body).toEqual({
    items: [
      { productId: 'candle', quantity: 2 },
      { productId: 'rooibos-tea', quantity: 1 },
    ],
    paymentMethod: 'demo',
    delivery: {
      name: 'Thandi Mokoena',
      phone: '0821234567',
      address: 'Flat 3, 12 Vilakazi Street',
      city: 'Soweto',
      province: 'Gauteng',
      postalCode: '1804',
    },
  });
  expect(await storedCart(page)).toEqual([]);
});

test('PayFast checkout posts the signed fields to PayFast and keeps the bag until payment is confirmed', async ({
  page,
  stub,
}) => {
  await stub.reset({ demoMode: false });
  await seed(page, { user: customer, cart: [line('candle', 1)] });
  await page.goto('/checkout');
  await expect(page.locator('input[name=address]')).toHaveValue('Flat 3, 12 Vilakazi Street');
  await page.getByRole('button', { name: /Continue to PayFast sandbox/ }).click();

  await expect(page.getByRole('heading', { name: 'PayFast sandbox (stub)' })).toBeVisible();
  const requests = await stub.requests();
  expect(requests.find((r) => r.path === '/api/orders/checkout').body.paymentMethod).toBe(
    'payfast',
  );
  // R219 + R79 delivery, posted as PayFast form fields rather than trusted from the browser later.
  expect(requests.find((r) => r.path === '/__stub/payfast').body).toEqual({
    merchant_id: '10000100',
    m_payment_id: 'ord-1',
    amount: '298.00',
    signature: 'test-signature',
  });
  // Leaving for PayFast is not proof of payment: the bag stays, with the order remembered.
  expect(await storedCart(page)).toEqual([['candle', 1]]);
  const pending = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('kasi_pending_checkout')),
  );
  expect(pending).toEqual({
    orderId: 'ord-1',
    userId: 'u-1',
    items: [{ productId: 'candle', quantity: 1 }],
  });
});

test('a signed-out shopper is asked to sign in before checking out', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { cart: [line('candle', 1)] });
  await page.goto('/checkout');
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible();
  expect((await stub.requests()).some((r) => r.path === '/api/orders/checkout')).toBe(false);
});
