import { test, expect } from './fixtures.mjs';

const wakeCalls = (requests) =>
  requests.filter((r) => r.path === '/api/meta' && r.search.includes('wake=1'));
const appCalls = (requests) => requests.filter((r) => !wakeCalls([r]).length);

test('a sleeping API keeps the loader up, explains the wait, and only then boots the app', async ({
  page,
  stub,
}) => {
  // Two failed wake-ups, like a service still starting: about 4s of waiting.
  await stub.reset({ wakeFailures: 2 });
  await page.goto('/?wake=1');

  const splash = page.locator('#boot-splash');
  await expect(splash).toBeVisible();
  await expect(splash).toHaveAccessibleName('Loading KasiDrop');
  // The spinner shows at once; the explanation only appears if the wait drags on.
  await expect(page.locator('#boot-wake-message')).toBeHidden();
  await expect(page.locator('#boot-wake-message')).toBeVisible({ timeout: 5_000 });
  await expect(page.locator('#boot-wake-message')).toContainText('Waking up the shop');
  // Nothing but wake-up requests reached the API while it was asleep.
  expect(appCalls(await stub.requests())).toEqual([]);

  // Once it answers, the loader gives way to the real app.
  await expect(page.locator('.mobile-tabbar')).toBeAttached({ timeout: 15_000 });
  await expect(page.locator('#boot-splash')).toHaveCount(0);
  const requests = await stub.requests();
  expect(wakeCalls(requests)).toHaveLength(3);
  const lastWake = requests.findLastIndex((r) => r.search.includes('wake=1'));
  const firstApp = requests.findIndex((r) => !r.search.includes('wake=1'));
  expect(firstApp).toBeGreaterThan(lastWake);
});

test('an awake API is checked once, then reloads boot straight away', async ({ page, stub }) => {
  await stub.reset();
  await page.goto('/?wake=1');
  await expect(page.locator('.mobile-tabbar')).toBeAttached();
  expect(wakeCalls(await stub.requests())).toHaveLength(1);

  await page.reload();
  await expect(page.locator('.mobile-tabbar')).toBeAttached();
  expect(wakeCalls(await stub.requests())).toHaveLength(1);
  // The fast path never shows the explanation either.
  await expect(page.locator('#boot-wake-message')).toHaveCount(0);
});

test('local development never waits for the API', async ({ page, stub }) => {
  await stub.reset();
  await page.goto('/');
  await expect(page.locator('.mobile-tabbar')).toBeAttached();
  expect(wakeCalls(await stub.requests())).toEqual([]);
});
