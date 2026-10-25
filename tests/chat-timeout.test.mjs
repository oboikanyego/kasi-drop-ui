import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource } from './source.mjs';

const api = readSource('src/app/store.service.ts');
const app = readSource('src/app/app.component.ts');

test('chat requests time out after the API budget plus network room', () => {
  assert.match(api, /export const chatTimeoutMs=20_000/);
  assert.match(api, /'\/ai\/chat',\{message\}\)\.pipe\(timeout\(chatTimeoutMs\)\)/);
});
test('a timed-out chat tells the shopper and ends the thinking state', () => {
  assert.match(app, /error\?\.name==='TimeoutError'\?'Kasi AI is taking too long/);
  const handler = app.slice(app.indexOf('error:error=>'));
  assert.match(handler, /this\.thinking\.set\(false\)/);
});
