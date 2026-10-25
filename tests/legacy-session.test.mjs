import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateLegacySession, legacyTokenKey } from '../src/app/legacy-session.ts';

const memoryStorage = (entries) => {
  const map = new Map(Object.entries(entries));
  return { getItem: (k) => map.get(k) ?? null, removeItem: (k) => map.delete(k), map };
};

test('nothing happens without a stored token', async () => {
  let called = false;
  const result = await migrateLegacySession(
    memoryStorage({}),
    async () => ((called = true), new Response()),
  );
  assert.equal(result, 'none');
  assert.equal(called, false);
});
test('a stored token is exchanged for the cookie and removed', async () => {
  const storage = memoryStorage({ [legacyTokenKey]: 'old-jwt', kasi_user: '{"id":"u-1"}' });
  let request;
  const result = await migrateLegacySession(storage, async (url, init) => {
    request = { url, init };
    return new Response('{}', { status: 200 });
  });
  assert.equal(result, 'migrated');
  assert.equal(request.url, '/api/auth/session');
  assert.equal(request.init.method, 'POST');
  assert.equal(request.init.headers.Authorization, 'Bearer old-jwt');
  assert.equal(request.init.headers['X-KasiDrop-CSRF'], '1');
  assert.equal(storage.map.has(legacyTokenKey), false);
  assert.equal(storage.map.has('kasi_user'), true);
});
test('a rejected token signs the remembered user out', async () => {
  const storage = memoryStorage({ [legacyTokenKey]: 'expired', kasi_user: '{"id":"u-1"}' });
  assert.equal(
    await migrateLegacySession(storage, async () => new Response('{}', { status: 401 })),
    'rejected',
  );
  assert.equal(storage.map.size, 0);
});
test('a network failure keeps the token for the next visit', async () => {
  const storage = memoryStorage({ [legacyTokenKey]: 'old-jwt' });
  assert.equal(
    await migrateLegacySession(storage, async () => Promise.reject(new TypeError('offline'))),
    'offline',
  );
  assert.equal(storage.map.get(legacyTokenKey), 'old-jwt');
});
