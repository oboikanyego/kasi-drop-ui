import { test, expect, seed, customer, line, storedCart, products } from './fixtures.mjs';

const candle = products.find((p) => p.id === 'candle');
const payfastOrder = {
  id: 'ord-pf-1',
  items: [{ productId: 'candle', name: candle.name, price: 219, quantity: 1, image: candle.image }],
  subtotal: 219,
  shipping: 79,
  total: 298,
  status: 'pending_payment',
  createdAt: '2026-10-25T10:00:00.000Z',
  delivery: { name: 'Thandi Mokoena', address: '12 Vilakazi Street', city: 'Soweto' },
};
const pendingCheckout = {
  orderId: 'ord-pf-1',
  userId: 'u-1',
  items: [{ productId: 'candle', quantity: 1 }],
};
const notice = (page) => page.locator('.payment-status-notice');
const bag = [line('candle', 2), line('rooibos-tea', 1)];

test('after PayFast confirms, only the purchased quantity leaves the bag', async ({
  page,
  stub,
}) => {
  // The first poll still sees the order pending; PayFast's server callback lands before the second.
  await stub.reset({
    orders: [payfastOrder],
    sequences: { 'ord-pf-1': ['pending_payment', 'paid'] },
  });
  await seed(page, { user: customer, cart: bag, pendingCheckout });
  await page.goto('/orders?payment=return');
  await expect(notice(page)).toContainText('Checking your payment');
  await expect(notice(page)).toContainText('Payment confirmed!', { timeout: 10_000 });
  expect(await storedCart(page)).toEqual([
    ['candle', 1],
    ['rooibos-tea', 1],
  ]);
  expect(await page.evaluate(() => sessionStorage.getItem('kasi_pending_checkout'))).toBeNull();
});

test('a failed payment keeps the whole bag', async ({ page, stub }) => {
  await stub.reset({
    orders: [payfastOrder],
    sequences: { 'ord-pf-1': ['pending_payment', 'failed'] },
  });
  await seed(page, { user: customer, cart: bag, pendingCheckout });
  await page.goto('/orders?payment=return');
  await expect(notice(page)).toContainText('Payment was not completed', { timeout: 10_000 });
  expect(await storedCart(page)).toEqual([
    ['candle', 2],
    ['rooibos-tea', 1],
  ]);
});

test('a payment held for review keeps the bag and says so', async ({ page, stub }) => {
  await stub.reset({ orders: [{ ...payfastOrder, status: 'requires_review' }] });
  await seed(page, { user: customer, cart: bag, pendingCheckout });
  await page.goto('/orders?payment=return');
  await expect(notice(page)).toContainText('requires review');
  expect(await storedCart(page)).toEqual([
    ['candle', 2],
    ['rooibos-tea', 1],
  ]);
});

test('a cancelled PayFast checkout keeps the bag and does not poll', async ({ page, stub }) => {
  await stub.reset({ orders: [payfastOrder] });
  await seed(page, { user: customer, cart: bag, pendingCheckout });
  await page.goto('/orders?payment=cancel');
  await expect(notice(page)).toContainText('Checkout was cancelled. Your bag has been kept.');
  await page.waitForTimeout(4_000);
  const listCalls = (await stub.requests()).filter((r) => r.path === '/api/orders');
  expect(listCalls).toHaveLength(1);
});

test('a confirmed payment for another account never touches this bag', async ({ page, stub }) => {
  await stub.reset({ orders: [{ ...payfastOrder, status: 'paid' }] });
  await seed(page, {
    user: customer,
    cart: bag,
    pendingCheckout: { ...pendingCheckout, userId: 'someone-else' },
  });
  await page.goto('/orders?payment=return');
  await expect(page.locator('.order-card')).toHaveCount(1);
  await expect(notice(page)).not.toContainText('Payment confirmed');
  expect(await storedCart(page)).toEqual([
    ['candle', 2],
    ['rooibos-tea', 1],
  ]);
});
