import { readFileSync } from 'node:fs';
/**
 * Read source code in a formatting-independent compact form, so tests that assert on source
 * text survive Prettier: whitespace around punctuation, trailing commas and `(x) =>` parens are removed.
 */
export function compactSource(code) {
  return code
    .replace(/\s+/g, ' ')
    .replace(/ ?([^\w\s$]) ?/g, '$1')
    .replace(/,([)\]}])/g, '$1')
    .replace(/\(([\w$]+)\)=>/g, '$1=>');
}
export const readSource = (path) => compactSource(readFileSync(path, 'utf8'));
/** Stylesheets keep the space in descendant selectors (`.a .b`); only spacing around `{}:;,` is removed. */
export const readStyles = (path) =>
  readFileSync(path, 'utf8')
    .replace(/\s+/g, ' ')
    .replace(/ ?([{}:;,]) ?/g, '$1')
    .replace(/;}/g, '}');
