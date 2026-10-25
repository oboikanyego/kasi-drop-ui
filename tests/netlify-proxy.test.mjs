import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('Netlify forwards API requests to current KasiDrop Render backend',()=>{
 const toml=readFileSync(new URL('../netlify.toml',import.meta.url),'utf8');
 assert.match(toml,/from\s*=\s*"\/api\/\*"/);
 assert.match(toml,/to\s*=\s*"https:\/\/kasi-drop-api-9rdp\.onrender\.com\/api\/:splat"/);
 assert.match(toml,/status\s*=\s*200/);
 assert.doesNotMatch(toml,/https:\/\/kasi-drop-api\.onrender\.com/);
});
