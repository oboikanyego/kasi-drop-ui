import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const appRoot = resolve('src/app');
const registry = readFileSync(resolve(appRoot, 'icons.ts'), 'utf8');
const registered = new Set(
  Array.from(registry.matchAll(/^\s*'?([a-z0-9-]+)'?:\s*\w+,?$/gm), (match) => match[1]),
);
const names = new Set();
for (const filename of readdirSync(appRoot).filter((file) => file.endsWith('.html'))) {
  const html = readFileSync(resolve(appRoot, filename), 'utf8');
  for (const match of html.matchAll(/<ion-icon\b[^>]*\bname="([a-z0-9-]+)"/g)) names.add(match[1]);
  // Dynamically bound name values, e.g. condition ? 'heart' : 'heart-outline'.
  for (const match of html.matchAll(/<ion-icon\b[^>]*\[name\]="([^"]+)"/g)) {
    for (const value of match[1].matchAll(/'([a-z0-9-]+)'/g)) names.add(value[1]);
  }
}
test('every icon referenced by an Ionic template is registered', () => {
  assert.ok(names.size >= 20, 'Expected a meaningful icon inventory');
  assert.deepEqual(
    [...names].filter((name) => !registered.has(name)),
    [],
    'Unregistered template icons',
  );
});
test('icons are bootstrapped before the UI renders', () => {
  const main = readFileSync('src/main.ts', 'utf8');
  assert.ok(main.indexOf('registerKasiDropIcons();') !== -1);
  assert.ok(main.indexOf('registerKasiDropIcons();') < main.indexOf('bootstrapApplication('));
});
test('Ionicons SVGs are bundled as same-origin assets', () => {
  const angular = JSON.parse(readFileSync('angular.json', 'utf8'));
  const assets = angular.projects['kasi-drop-ui'].architect.build.options.assets;
  assert.ok(
    assets.some(
      (a) =>
        typeof a === 'object' &&
        a.input === 'node_modules/ionicons/dist/ionicons/svg' &&
        a.output === '/svg',
    ),
  );
});
