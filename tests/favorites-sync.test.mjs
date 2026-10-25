import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource } from './source.mjs';
const store = readSource('src/app/store.service.ts');
test('signed-in favourites are loaded from backend, guest storage is distinct', () => {
  assert.match(store, /getFavorites\(\)\{/);
  assert.match(store, /private loadAccountFavorites\(\)/);
  assert.match(store, /kasi_guest_favorites/);
  assert.doesNotMatch(store, /localStorage\.setItem\('kasi_favorites'/);
});
test('login merges guest favourites and logout returns to guest list', () => {
  assert.match(store, /this\.syncGuestFavorites\(user\)/);
  assert.match(store, /mergeFavorites\(guestIds\)/);
  assert.match(store, /localStorage\.removeItem\('kasi_guest_favorites'\)/);
  assert.match(store, /this\.favoritesRevision\+\+/);
});
test('remote edits use account endpoints and check stale user context', () => {
  assert.match(store, /this\.favoritesApi\.addFavorite\(id\)/);
  assert.match(store, /this\.favoritesApi\.removeFavorite\(id\)/);
  assert.match(store, /this\.user\(\)\?\.id!==user\.id/);
});
