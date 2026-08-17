import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products } from '../src/data/products.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

try {
  const source = await readFile(path.join(projectRoot, '.env'), 'utf8');
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch {
  // Environment variables and production defaults are sufficient.
}

const siteUrl = (process.env.SITE_URL || 'https://geelarkflows.com').replace(/\/+$/, '');
const key = process.env.INDEXNOW_KEY || '4a0e17038739472cad3cd17a15f9e39c';
const host = new URL(siteUrl).host;
const urlList = [
  `${siteUrl}/`,
  ...products.map((product) => `${siteUrl}/flows/${product.id}/`),
];

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host,
    key,
    keyLocation: `${siteUrl}/${key}.txt`,
    urlList,
  }),
});

if (!response.ok) {
  throw new Error(`IndexNow submission failed with HTTP ${response.status}: ${await response.text()}`);
}

console.log(`IndexNow accepted ${urlList.length} URLs for ${host}.`);
