import { test, expect } from './fixtures.mjs';

test('feedback form is usable on a small phone and validates messages', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto('/feedback');
  await expect(page.getByRole('heading', { name: 'Help shape the next KasiDrop.' })).toBeVisible();
  await expect(page.locator('.feedback-card')).toBeVisible();
  const submit = page.getByRole('button', { name: 'Send feedback' });
  await expect(submit).toBeDisabled();
  await page.getByLabel('Your feedback').fill('A good shopping experience with local products.');
  await expect(submit).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
});
test('customers see a confirmation when feedback is accepted', async ({ page }) => {
  let payload;
  await page.route('**/api/feedback', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ received: true }) });
  });
  await page.goto('/feedback');
  await page.getByLabel('What is this about?').selectOption('bug');
  await page.getByLabel('Your feedback').fill('The catalogue could load faster on my phone.');
  await page.getByRole('button', { name: 'Send feedback' }).click();
  await expect(page.getByRole('status')).toContainText('feedback has been received');
  expect(payload).toMatchObject({ category: 'bug', message: 'The catalogue could load faster on my phone.' });
});
