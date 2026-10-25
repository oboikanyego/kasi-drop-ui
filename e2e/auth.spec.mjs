import { test, expect, seed, customer } from './fixtures.mjs';

/** Everything page scripts can read: localStorage, sessionStorage and document.cookie. */
const scriptVisibleState = (page) =>
  page.evaluate(() => ({
    storage: JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }),
    cookies: document.cookie,
  }));

test('signing in keeps the session in an httpOnly cookie that page scripts cannot read', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await seed(page);
  await page.goto('/account');
  await page.locator('input[name=email]').fill('thandi@example.com');
  await page.locator('input[name=password]').fill('Demo@12345');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: /Sign out/ })).toBeVisible();

  const visible = await scriptVisibleState(page);
  expect(visible.storage).not.toContain('body-token-must-not-be-stored');
  expect(visible.storage).not.toContain('kasi_token');
  expect(visible.cookies).not.toContain('kasi_session');
  // The profile loads using the cookie alone.
  const profile = (await stub.requests()).find((r) => r.path === '/api/profile');
  expect(profile.auth).toBe('');
  expect(profile.cookie).toMatch(/kasi_session=/);
  const cookies = await page.context().cookies();
  expect(cookies.find((c) => c.name === 'kasi_session')).toMatchObject({
    httpOnly: true,
    path: '/api',
  });
});

test('a token left in localStorage by the old UI is swapped for the cookie and removed', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await seed(page, { user: customer, session: false, storage: { kasi_token: 'legacy-jwt' } });
  await page.goto('/account');
  await expect(page.getByRole('button', { name: /Sign out/ })).toBeVisible();

  const exchange = (await stub.requests()).find((r) => r.path === '/api/auth/session');
  expect(exchange).toMatchObject({ method: 'POST', auth: 'Bearer legacy-jwt' });
  expect(await page.evaluate(() => localStorage.getItem('kasi_token'))).toBeNull();
  const later = (await stub.requests()).filter((r) => r.path === '/api/profile');
  expect(later.at(-1).cookie).toMatch(/kasi_session=/);
});

test('a remembered user whose session has expired is signed out', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: customer, session: false });
  await page.goto('/account');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('kasi_user'))).toBeNull();
});

test('signing out asks the API to clear the cookie', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: customer });
  await page.goto('/account');
  await page.getByRole('button', { name: /Sign out/ }).click();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeVisible();

  await expect
    .poll(async () => (await stub.requests()).some((r) => r.path === '/api/auth/logout'))
    .toBe(true);
  expect((await page.context().cookies()).some((c) => c.name === 'kasi_session')).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('kasi_user'))).toBeNull();
});
