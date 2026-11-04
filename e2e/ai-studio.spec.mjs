import { test, expect, seed, admin } from './fixtures.mjs';

const hintNeedsNotes = 'Type at least 5 characters about your product to enable drafting.';

async function openAiStudio(page) {
  await seed(page, { user: admin });
  await page.goto('/admin');
  await page.getByRole('button', { name: '+ Add product' }).click();
  const studio = page.locator('.ai-editor');
  return {
    studio,
    notes: studio.locator('textarea'),
    generate: studio.getByRole('button', { name: /Generate listing/ }),
    hint: studio.locator('.ai-hint'),
    form: page.locator('.admin-editor form'),
  };
}

test('the studio says what it needs before Generate listing works', async ({ page, stub }) => {
  await stub.reset();
  const { studio, notes, generate, hint } = await openAiStudio(page);
  // The footnote describes what the studio does, and no longer mentions Claude.
  await expect(studio).toContainText('Kasi AI drafts from your notes and can get details wrong');
  await expect(studio).not.toContainText('Claude');

  await expect(generate).toBeDisabled();
  await expect(hint).toHaveText(hintNeedsNotes);
  await notes.fill('beads'); // five characters is enough
  await expect(generate).toBeEnabled();
  await expect(hint).toHaveCount(0);
  await notes.fill('bead'); // four is not
  await expect(generate).toBeDisabled();
  await expect(hint).toHaveText(hintNeedsNotes);
});

test('spaces do not count as notes', async ({ page, stub }) => {
  await stub.reset();
  const { notes, generate, hint } = await openAiStudio(page);
  await notes.fill('          ');
  await expect(generate).toBeDisabled();
  await expect(hint).toHaveText(hintNeedsNotes);
});

test('a draft fills in the form for review', async ({ page, stub }) => {
  await stub.reset();
  const { notes, generate, form } = await openAiStudio(page);
  await notes.fill('Hand beaded keyring, glass beads, made in Soweto');
  await generate.click();

  await expect(page.locator('.success-msg')).toHaveText('AI draft created — review before saving');
  await expect(form.locator('input[name=name]')).toHaveValue('Hand-Beaded Heritage Keyring');
  await expect(form.locator('textarea[name=description]')).toHaveValue(
    'A hand-beaded keyring made in Soweto from glass beads.',
  );
  await expect(form.locator('input[name=tags]')).toHaveValue('beaded, handmade, gift');
  const request = (await stub.requests()).find((r) => r.path === '/api/admin/ai/listing');
  expect(request.body).toMatchObject({ notes: 'Hand beaded keyring, glass beads, made in Soweto' });
});

test('when the server has no AI key, the studio says so and stays off', async ({ page, stub }) => {
  await stub.reset({ aiEnabled: false });
  const { notes, generate, hint } = await openAiStudio(page);
  await notes.fill('Hand beaded keyring, glass beads, made in Soweto');
  await expect(hint).toContainText("AI drafting isn't set up on the server yet");
  await expect(hint).toContainText('GEMINI_API_KEY or GROQ_API_KEY');
  await expect(generate).toBeDisabled();
});

test("a draft the server cannot make shows the server's reason", async ({ page, stub }) => {
  await stub.reset({ aiListingError: 'Set GEMINI_API_KEY or GROQ_API_KEY on backend' });
  const { notes, generate } = await openAiStudio(page);
  await notes.fill('Hand beaded keyring, glass beads, made in Soweto');
  await generate.click();
  await expect(page.locator('.error-msg')).toHaveText(
    'Set GEMINI_API_KEY or GROQ_API_KEY on backend',
  );
  await expect(generate).toBeEnabled(); // it can be tried again
});
