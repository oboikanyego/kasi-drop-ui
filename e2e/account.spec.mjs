import { test, expect, seed, customer, makePng } from './fixtures.mjs';

test('a profile photo is shrunk to 600px, uploaded and shown', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: customer });
  await page.goto('/account');
  await page.getByLabel('Upload a new profile photo').setInputFiles({
    name: 'me.png',
    mimeType: 'image/png',
    buffer: makePng(1500, 1000),
  });

  await expect(page.locator('.profile-portrait img')).toHaveAttribute('src', /^blob:/);
  const upload = (await stub.requests()).find(
    (r) => r.path === '/api/profile/avatar' && r.method === 'PUT',
  );
  expect(upload.body).toMatchObject({ contentType: 'image/jpeg', width: 600, height: 400 });
  expect(upload.body.size).toBeLessThanOrEqual(512 * 1024);
});

test('a profile photo that is not an image is refused', async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: customer });
  await page.goto('/account');
  await page.getByLabel('Upload a new profile photo').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(page.getByText('Choose a JPG, PNG or WebP image.')).toBeVisible();
  expect(
    (await stub.requests()).some((r) => r.path === '/api/profile/avatar' && r.method === 'PUT'),
  ).toBe(false);
});
