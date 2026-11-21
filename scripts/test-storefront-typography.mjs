import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const globals = read('src/index.css');
const app = read('src/App.css');
const cards = read('src/components/FlowCard.css');
const filters = read('src/components/FilterHeader.css');
const flowDetailPage = read('src/pages/FlowDetailPage.css');
const customRequest = read('src/components/CustomRequestModal.css');
const html = read('index.html');

assert.match(globals, /--type-caption:\s*0\.75rem;/, 'Caption text must not fall below the 12px typography floor.');
assert.match(globals, /--type-body:\s*1rem;/, 'Storefront body text must use a 1rem baseline.');
assert.match(globals, /--leading-reading:\s*1\.6;/, 'Reading text needs a generous unitless line height.');
assert.match(globals, /font-size:\s*100%;/, 'The root size must stay relative to the browser preference.');
assert.match(globals, /text-size-adjust:\s*100%;/, 'Mobile browser text adjustment must remain enabled.');

for (const [name, content] of [
  ['homepage', app],
  ['workflow cards', cards],
  ['catalog filters', filters],
  ['flow detail page', flowDetailPage],
  ['custom-request dialog', customRequest],
]) {
  assert.ok(content.includes('var(--type-'), `${name} must consume the shared responsive type scale.`);
}

assert.match(cards, /\.flow-description[^}]+font-size:\s*0\.9375rem;[^}]+line-height:\s*var\(--leading-reading\);/, 'Card descriptions must use readable size and spacing.');
assert.doesNotMatch(cards, /-webkit-line-clamp/, 'Card descriptions must remain available when users enlarge or space text.');
assert.match(cards, /\.flow-row-action[^}]+font-size:\s*var\(--type-small\);/, 'Card actions must use legible control text.');
assert.match(html, /Manrope:wght@400\.\.800/, 'Manrope must load as a variable font so authored intermediate weights are supported.');
assert.doesNotMatch(app, /\{[^}]*padding:[^;}]*calc\(\(100%\s*-\s*var\(--site-width\)\)\s*\/\s*2\)/, 'A max-width section must not derive its padding from the full viewport width.');
assert.match(globals, /color-scheme:\s*light;/, 'The storefront ships a single light theme.');
assert.doesNotMatch(app, /gradient/, 'The home page stays flat: no gradients.');

console.log('Storefront typography regression checks passed.');
