import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptedImageTypes,
  checkImageFile,
  fitWithin,
  maxPickedBytes,
} from '../src/app/image-upload.ts';

test('only JPEG, PNG and WebP files up to 5 MB can be picked', () => {
  for (const type of acceptedImageTypes)
    assert.equal(checkImageFile({ type, size: 1000 }), null, type);
  assert.equal(checkImageFile({ type: 'image/png', size: maxPickedBytes }), null);
  for (const type of ['image/gif', 'image/svg+xml', 'application/pdf', 'text/plain', ''])
    assert.equal(checkImageFile({ type, size: 1000 }), 'Choose a JPG, PNG or WebP image.', type);
  assert.equal(
    checkImageFile({ type: 'image/jpeg', size: maxPickedBytes + 1 }),
    'Choose an image smaller than 5 MB.',
  );
});
test('a photo is scaled to fit on its longer edge, keeping its shape', () => {
  assert.deepEqual(fitWithin(3000, 2000, 1200), { width: 1200, height: 800 });
  assert.deepEqual(fitWithin(2000, 3000, 1200), { width: 800, height: 1200 });
  assert.deepEqual(fitWithin(4000, 4000, 600), { width: 600, height: 600 });
});
test('a photo is never enlarged and never collapses to nothing', () => {
  assert.deepEqual(fitWithin(600, 400, 1200), { width: 600, height: 400 });
  assert.deepEqual(fitWithin(1200, 1200, 1200), { width: 1200, height: 1200 });
  assert.deepEqual(fitWithin(10000, 1, 1200), { width: 1200, height: 1 });
});
