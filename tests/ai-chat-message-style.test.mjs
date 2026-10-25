import test from 'node:test';
import assert from 'node:assert/strict';
import { readSource, readStyles } from './source.mjs';
const html = readSource('src/app/app.component.html');
const css = readStyles('src/styles.scss');
test('chat uses sender labels and bubble markup', () => {
  assert.match(html, /message\.from==='user'\?'You':'Kasi AI'/);
  assert.match(html, /class="assistant-message-label"/);
  assert.match(html, /class="assistant-bubble"/);
  assert.match(html, /aria-label.*Your message.*Kasi AI response/);
});
test('sent and AI messages have distinct targeted styles', () => {
  assert.match(css, /\.assistant-message\.sent \.assistant-bubble\s*\{/);
  assert.match(css, /\.assistant-message \.assistant-bubble\s*\{/);
  assert.match(css, /\.assistant-message\.sent\s*\{align-items:flex-end\}/);
  assert.match(css, /background:#def5a1/);
  assert.match(css, /background:#f1f3f4/);
});
test('suggested product cards remain associated with chat responses', () => {
  assert.match(html, /message\.products\?\.length/);
  assert.match(html, /class="assistant-suggestions"/);
  assert.match(html, /addSuggestedProduct\(product\)/);
});
