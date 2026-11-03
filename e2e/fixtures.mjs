import { test as base, expect } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';
import { products } from './stub-server-data.mjs';

const encodeSession = (user) => Buffer.from(JSON.stringify(user)).toString('base64url');

export { expect, products };
export const customer = {
  id: 'u-1',
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  role: 'customer',
};
export const admin = { id: 'a-1', name: 'Demo Admin', email: 'admin@example.com', role: 'admin' };
export const line = (id, quantity) => ({ product: products.find((p) => p.id === id), quantity });

export const test = base.extend({
  page: async ({ page }, use) => {
    // Product photos point at external CDNs; keep tests offline and fast.
    await page.route(/^https:\/\//, (route) => route.abort());
    await use(page);
  },
  stub: async ({ request }, use) => {
    await use({
      reset: (options = {}) => request.post('/__stub/reset', { data: options }),
      requests: async () => (await request.get('/__stub/requests')).json(),
    });
  },
});

/**
 * Seed the signed-in user (an httpOnly session cookie, as the API sets it), the bag and the pending
 * checkout once per tab, before the app boots. `storage` adds raw localStorage entries.
 */
export async function seed(
  page,
  { user, cart = [], pendingCheckout, session = true, storage = {} } = {},
) {
  if (user && session)
    await page.context().addCookies([
      {
        name: 'kasi_session',
        value: encodeSession(user),
        domain: 'localhost',
        path: '/api',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
  await page.addInitScript(
    ({ user, cart, pendingCheckout, storage }) => {
      if (sessionStorage.getItem('__e2e_seeded')) return;
      sessionStorage.setItem('__e2e_seeded', '1');
      if (user) localStorage.setItem('kasi_user', JSON.stringify(user));
      for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
      localStorage.setItem('kasi_cart', JSON.stringify(cart));
      localStorage.setItem('kasi_selected', JSON.stringify(cart.map((l) => l.product.id)));
      if (pendingCheckout)
        sessionStorage.setItem('kasi_pending_checkout', JSON.stringify(pendingCheckout));
    },
    { user, cart, pendingCheckout, storage },
  );
}
export const storedCart = (page) =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem('kasi_cart') || '[]').map((l) => [l.product.id, l.quantity]),
  );

/** A plain-colour PNG of any size, so tests can pick real photos without checked-in image files. */
export function makePng(width, height, [r, g, b] = [120, 170, 60]) {
  const row = Buffer.alloc(1 + width * 3); // each row starts with a filter byte of 0
  for (let x = 0; x < width; x++) row.set([r, g, b], 1 + x * 3);
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8); // 8 bits per channel, RGB
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
