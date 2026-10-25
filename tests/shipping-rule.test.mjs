import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultShippingRule, parseShippingRule, shippingFor } from '../src/app/shipping-rule.ts';
import { readSource } from './source.mjs';

test('delivery is free for an empty bag and at or over the threshold', () => {
  const rule = { freeFrom: 750, fee: 79 };
  assert.equal(shippingFor(0, rule), 0);
  assert.equal(shippingFor(749.99, rule), 79);
  assert.equal(shippingFor(750, rule), 0);
});
test('the API rule replaces the default when it is valid', () => {
  assert.deepEqual(parseShippingRule({ freeFrom: 500, fee: 60 }), { freeFrom: 500, fee: 60 });
  assert.equal(shippingFor(600, parseShippingRule({ freeFrom: 500, fee: 60 })), 0);
});
test('a missing or malformed API rule is ignored', () => {
  for (const value of [
    undefined,
    null,
    {},
    { freeFrom: '750', fee: 79 },
    { freeFrom: 750, fee: -1 },
    { freeFrom: NaN, fee: 79 },
  ])
    assert.equal(parseShippingRule(value), null, JSON.stringify(value));
  assert.deepEqual(defaultShippingRule, { freeFrom: 750, fee: 79 });
});
test('templates read the threshold from the store instead of hard-coding it', () => {
  for (const page of ['cart', 'home', 'product']) {
    const html = readSource(`src/app/${page}.page.html`);
    assert.match(html, /store\.shippingRule\(\)\.freeFrom/, page);
    assert.doesNotMatch(html, /750/, page);
  }
  assert.match(readSource('src/app/app.component.ts'), /store\.useShippingRule\(meta\.shipping\)/);
});
