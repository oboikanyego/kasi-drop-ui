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

// A tab left open can outlive the API's sleep. Ageing the remembered confirmation makes the page
// believe it has been idle, and the same event a returning tab fires starts the check.
const goIdle = (page) =>
  page.evaluate(() => localStorage.setItem('kasi_api_awake_at', String(Date.now() - 20 * 60_000)));
const comeBack = (page) =>
  page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
const confirmedAgo = (page) =>
  page.evaluate(() => Date.now() - Number(localStorage.getItem('kasi_api_awake_at')));

test('returning to an idle tab covers the page until a sleeping API is awake again', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await page.goto('/?wake=1');
  await expect(page.locator('.mobile-tabbar')).toBeAttached();

  // While the tab sat idle the API went to sleep: its next two wake-ups fail.
  await stub.reset({ wakeFailures: 2 });
  await goIdle(page);
  await comeBack(page);

  const overlay = page.locator('#wake-overlay');
  await expect(overlay).toBeVisible({ timeout: 3_000 });
  await expect(overlay).toHaveAccessibleName('Waking up KasiDrop');
  await expect(overlay).toContainText('waking it up');
  // Nothing behind the loader can be clicked or tabbed to.
  await expect(page.locator('app-root')).toHaveAttribute('inert', '');

  await expect(overlay).toHaveCount(0, { timeout: 15_000 });
  await expect(page.locator('app-root')).not.toHaveAttribute('inert', '');
  // Two failures and then the answer, and the API is remembered as awake again.
  expect(wakeCalls(await stub.requests())).toHaveLength(3);
  expect(await confirmedAgo(page)).toBeLessThan(60_000);
  // The page is usable again.
  await page
    .getByRole('link', { name: /Favourites/ })
    .first()
    .click();
  await expect(page).toHaveURL(/favorites/);
});

test('returning to an idle tab with the API awake checks quietly and never flashes the loader', async ({
  page,
  stub,
}) => {
  // Record whether the loader is ever added to the page, however briefly.
  await page.addInitScript(() => {
    window.__sawWakeOverlay = false;
    new MutationObserver(() => {
      if (document.getElementById('wake-overlay')) window.__sawWakeOverlay = true;
    }).observe(document, { childList: true, subtree: true });
  });
  await stub.reset();
  await page.goto('/?wake=1');
  await expect(page.locator('.mobile-tabbar')).toBeAttached();

  await goIdle(page);
  await comeBack(page);
  await expect.poll(async () => wakeCalls(await stub.requests()).length).toBe(2);
  // Long enough for a loader that had not been cancelled to have appeared.
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => window.__sawWakeOverlay)).toBe(false);
  expect(await confirmedAgo(page)).toBeLessThan(60_000);
});

test('returning to a tab does nothing when the API was confirmed recently or the tab is hidden', async ({
  page,
  stub,
}) => {
  await stub.reset();
  await page.goto('/?wake=1');
  await expect(page.locator('.mobile-tabbar')).toBeAttached();
  expect(wakeCalls(await stub.requests())).toHaveLength(1);

  await comeBack(page); // confirmed a moment ago
  await page.waitForTimeout(700);
  expect(wakeCalls(await stub.requests())).toHaveLength(1);

  await goIdle(page);
  await page.evaluate(() =>
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }),
  );
  await comeBack(page); // idle, but the tab is not visible
  await page.waitForTimeout(700);
  expect(wakeCalls(await stub.requests())).toHaveLength(1);
});
