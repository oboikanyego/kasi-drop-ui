import { test, expect, seed, admin, makePng } from './fixtures.mjs';

const png = (name, width, height) => ({
  name,
  mimeType: 'image/png',
  buffer: makePng(width, height),
});
const uploads = async (stub) =>
  (await stub.requests()).filter((r) => r.path === '/api/admin/images');

async function openAddForm(page) {
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Add product' }).click();
  return page.locator('.admin-editor form');
}
const choosePhoto = (form, file) => form.locator('input[type=file]').setInputFiles(file);
const publish = (form) => form.getByRole('button', { name: /Publish product/ });
async function fillRequiredFields(form) {
  await form.locator('input[name=name]').fill('Beaded Keyring');
  await form.locator('textarea[name=description]').fill('Hand-beaded keyring made in Soweto.');
}

test.beforeEach(async ({ page, stub }) => {
  await stub.reset();
  await seed(page, { user: admin });
});

test('the form asks for a photo to upload, not an image link', async ({ page }) => {
  const form = await openAddForm(page);
  await expect(form.getByText('Product photo')).toBeVisible();
  await expect(form.getByLabel('Image URL')).toHaveCount(0);
  await expect(form.locator('input[type=url]')).toHaveCount(0);
  await expect(form.locator('input[type=file]')).toHaveAttribute(
    'accept',
    'image/jpeg,image/png,image/webp',
  );
  // Nothing can be published until a photo is up.
  await expect(form.locator('.photo-preview')).toHaveText('No photo yet');
  await expect(form.getByText('Add a photo to publish your product.')).toBeVisible();
  await expect(publish(form)).toBeDisabled();
});

test('a big photo is shrunk, uploaded and previewed, and its path is what gets published', async ({
  page,
  stub,
}) => {
  const form = await openAddForm(page);
  await fillRequiredFields(form);
  await choosePhoto(form, png('shelf.png', 3000, 2000));

  await expect(form.locator('.photo-preview img')).toHaveAttribute('src', /^blob:/);
  await expect(publish(form)).toBeEnabled();
  await expect(form.getByText('Add a photo to publish your product.')).toHaveCount(0);
  await expect(form.getByRole('button', { name: 'Remove photo' })).toBeVisible();
  // 3000x2000 became a 1200x800 JPEG well under the API's 1 MB limit.
  const [upload] = await uploads(stub);
  expect(upload.body).toMatchObject({ contentType: 'image/jpeg', width: 1200, height: 800 });
  expect(upload.body.size).toBeLessThan(1024 * 1024);
  expect(upload.csrf).toBe('1');

  await publish(form).click();
  await expect(page.locator('.success-msg')).toHaveText('Product published');
  const created = (await stub.requests()).find(
    (r) => r.path === '/api/admin/products' && r.method === 'POST',
  );
  expect(created.body.image).toBe('/api/images/img-1');
});

test('a small photo is not enlarged', async ({ page, stub }) => {
  const form = await openAddForm(page);
  await choosePhoto(form, png('small.png', 600, 400));
  await expect(form.locator('.photo-preview img')).toBeVisible();
  const [upload] = await uploads(stub);
  expect(upload.body).toMatchObject({ contentType: 'image/jpeg', width: 600, height: 400 });
});

test('a photo can be replaced or removed', async ({ page, stub }) => {
  const form = await openAddForm(page);
  const pick = form.locator('.photo-pick');
  await expect(pick).toContainText('Choose photo');
  await choosePhoto(form, png('first.png', 800, 600));
  await expect(pick).toContainText('Replace photo');

  await choosePhoto(form, png('second.png', 500, 500));
  await expect.poll(async () => (await uploads(stub)).length).toBe(2);
  await expect(form.locator('.photo-preview img')).toBeVisible();

  await form.getByRole('button', { name: 'Remove photo' }).click();
  await expect(form.locator('.photo-preview')).toHaveText('No photo yet');
  await expect(pick).toContainText('Choose photo');
  await expect(publish(form)).toBeDisabled();
});

test('a file that is not a PNG, JPEG or WebP is refused without being uploaded', async ({
  page,
  stub,
}) => {
  const form = await openAddForm(page);
  await choosePhoto(form, {
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('hello'),
  });
  await expect(form.getByRole('alert')).toHaveText('Choose a JPG, PNG or WebP image.');
  await expect(publish(form)).toBeDisabled();

  // A file that claims to be an image but is not one.
  await choosePhoto(form, {
    name: 'fake.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not an image'),
  });
  await expect(form.getByRole('alert')).toHaveText('That file could not be read as an image.');
  expect(await uploads(stub)).toEqual([]);
});

test('an upload the API refuses shows why and keeps Publish disabled', async ({ page, stub }) => {
  await stub.reset({ imageUploadError: 'Unsupported image. Upload a JPEG, PNG or WebP photo.' });
  const form = await openAddForm(page);
  await choosePhoto(form, png('shelf.png', 800, 600));
  await expect(form.getByRole('alert')).toHaveText(
    'Unsupported image. Upload a JPEG, PNG or WebP photo.',
  );
  await expect(form.locator('.photo-preview')).toHaveText('No photo yet');
  await expect(publish(form)).toBeDisabled();
});

test('after publishing, the next product starts with an empty form', async ({ page }) => {
  const form = await openAddForm(page);
  await fillRequiredFields(form);
  await choosePhoto(form, png('shelf.png', 800, 600));
  await publish(form).click();
  await expect(page.locator('.success-msg')).toHaveText('Product published');

  await page.getByRole('button', { name: '+ Add product' }).click();
  await expect(form.locator('input[name=name]')).toHaveValue('');
  await expect(form.locator('.photo-preview')).toHaveText('No photo yet');
  await expect(publish(form)).toBeDisabled();
});
