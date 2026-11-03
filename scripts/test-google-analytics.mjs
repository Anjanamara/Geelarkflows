import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

const integration = read('src/googleAnalytics.js');
const app = read('src/App.jsx');
const worker = read('src/worker.js');
const privacy = read('src/pages/LegalPage.jsx');

assert.match(integration, /GOOGLE_TAG_ID\s*=\s*'G-BKDBCCN19B'/, 'The supplied Google measurement ID must be installed.');
assert.match(integration, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=/, 'The official gtag.js loader must be used.');
assert.match(integration, /send_page_view:\s*false/, 'Automatic page views must be disabled so SPA routes are not double-counted.');
assert.match(integration, /window\.gtag\('event',\s*'page_view'/, 'SPA navigation must emit an explicit page-view event.');
assert.match(integration, /allow_google_signals:\s*false/, 'Google advertising signals must remain disabled.');
assert.match(integration, /allow_ad_personalization_signals:\s*false/, 'Ad personalization must remain disabled.');
assert.match(integration, /analyticsDisabled\(\)/, 'GPC and Do Not Track must disable Google Analytics.');
assert.match(integration, /startsWith\('\/admin'\)/, 'Private administration routes must not be measured.');
assert.match(app, /trackGooglePageView\(currentPath\)/, 'The SPA router must track every real route change.');
assert.match(worker, /script-src 'self' https:\/\/www\.googletagmanager\.com/, 'The CSP must permit only the required Google tag script host.');
assert.match(worker, /connect-src 'self' https:\/\/\*\.google-analytics\.com/, 'The CSP must permit Google Analytics collection endpoints.');
assert.match(privacy, /Google Analytics 4/, 'The public privacy policy must disclose Google Analytics.');

console.log('Google tag, SPA routing, privacy controls, and CSP regression checks passed.');
