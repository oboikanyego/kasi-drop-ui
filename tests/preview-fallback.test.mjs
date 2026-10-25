import test from 'node:test';
import assert from 'node:assert/strict';
import { isApiUnavailable } from '../src/app/api-availability.ts';

test('network failures, timeouts and gateway errors fall back to preview', () => {
  for (const error of [
    { status: 0 },
    { status: 502 },
    { status: 503 },
    { status: 504 },
    { name: 'TimeoutError' },
  ])
    assert.equal(isApiUnavailable(error), true, JSON.stringify(error));
});
test('a 404 from the API itself is a real "not found", not an outage', () => {
  assert.equal(isApiUnavailable({ status: 404, error: { error: 'Not found' } }), false);
});
test('a 404 without the API error body means the API host is not serving', () => {
  assert.equal(isApiUnavailable({ status: 404, error: '<html>Not Found</html>' }), true);
  assert.equal(isApiUnavailable({ status: 404, error: null }), true);
});
test('other API errors are surfaced, not hidden behind preview data', () => {
  for (const status of [400, 401, 403, 409, 429, 500])
    assert.equal(isApiUnavailable({ status, error: { error: 'x' } }), false, String(status));
});
