import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const html = readFileSync('src/app/app.component.html', 'utf8');
const css = readFileSync('src/styles.scss', 'utf8');
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
