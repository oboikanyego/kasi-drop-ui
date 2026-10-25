import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync('src/app/app.component.ts', 'utf8');
const html = readFileSync('src/app/app.component.html', 'utf8');
test('chat preserves returned product suggestions on the correct message', () => {
  assert.match(code, /products:result\.products\|\|\[\]/);
  assert.match(code, /products\?:Product\[\]/);
  assert.match(html, /message\.products\?\.length/);
  assert.match(html, /\*ngFor="let product of message\.products"/);
});
test('assistant displays product name, image, price and navigable details', () => {
  assert.match(html, /\[src\]="product\.image"/);
  assert.match(html, /\{\{product\.name\}\}/);
  assert.match(html, /product\.price \| currency:'ZAR'/);
  assert.match(html, /\['\/product',product\.id\]/);
  assert.match(html, /onSuggestedImageError\(\$event\)/);
});
test('chat product add-to-cart uses stock checks and preserves backend actions', () => {
  assert.match(html, /addSuggestedProduct\(product\)/);
  assert.match(html, /\[disabled\]="!product\.active\|\|product\.stock<1"/);
  assert.match(code, /this\.store\.add\(product,1\)/);
  assert.match(code, /for\(const action of result\.cartActions\)/);
});
