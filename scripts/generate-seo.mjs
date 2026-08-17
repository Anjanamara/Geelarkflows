import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { products, platforms } from '../src/data/products.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(projectRoot, 'dist');

async function loadLocalEnv() {
  try {
    const source = await readFile(path.join(projectRoot, '.env'), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
    }
  } catch {
    // Production defaults below keep builds deterministic without a local .env file.
  }
}

await loadLocalEnv();

const siteUrl = (process.env.SITE_URL || 'https://geelarkflows.com').replace(/\/+$/, '');
const googleVerification = process.env.GOOGLE_SITE_VERIFICATION || '';
const bingVerification = process.env.BING_SITE_VERIFICATION || '';
const lastModified = new Date().toISOString().slice(0, 10);
const baseHtmlPath = path.join(distDir, 'index.html');
const baseHtml = await readFile(baseHtmlPath, 'utf8');

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const safeJson = (value) => JSON.stringify(value).replaceAll('<', '\\u003c');

const verificationMarkup = [
  googleVerification
    ? `<meta name="google-site-verification" content="${escapeHtml(googleVerification)}" />`
    : '',
  bingVerification
    ? `<meta name="msvalidate.01" content="${escapeHtml(bingVerification)}" />`
    : '',
].filter(Boolean).join('\n    ');

const addVerification = (html) => verificationMarkup
  ? html.replace('</head>', `    ${verificationMarkup}\n  </head>`)
  : html;

const rootHtml = addVerification(baseHtml);
await writeFile(baseHtmlPath, rootHtml, 'utf8');

const flowUrls = products.map((product) => `${siteUrl}/flows/${product.id}/`);
const sitemapUrls = [`${siteUrl}/`, ...flowUrls];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...sitemapUrls.map((url, index) => [
    '  <url>',
    `    <loc>${escapeHtml(url)}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    `    <changefreq>${index === 0 ? 'weekly' : 'monthly'}</changefreq>`,
    `    <priority>${index === 0 ? '1.0' : '0.8'}</priority>`,
    '  </url>',
  ].join('\n')),
  '</urlset>',
  '',
].join('\n');

await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(path.join(distDir, 'sitemap.txt'), `${sitemapUrls.join('\n')}\n`, 'utf8');
await writeFile(
  path.join(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
  'utf8',
);

for (const product of products) {
  const platform = platforms.find((item) => item.id === product.platform);
  const canonicalUrl = `${siteUrl}/flows/${product.id}/`;
  const title = `${product.title} GeeLark Flow | GeeLark Flows`;
  const description = `${product.details.description} Reusable GeeLark automation with unlimited runs. $${product.price.toLocaleString('en-US')} USD.`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name: product.title,
        description: product.details.description,
        category: `${platform?.label || product.platform} automation flow`,
        url: canonicalUrl,
        brand: { '@type': 'Brand', name: 'GeeLark Flows' },
        offers: {
          '@type': 'Offer',
          url: canonicalUrl,
          price: product.price,
          priceCurrency: 'USD',
          availability: 'https://schema.org/InStock',
          itemCondition: 'https://schema.org/NewCondition',
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'GeeLark Flows', item: `${siteUrl}/` },
          { '@type': 'ListItem', position: 2, name: platform?.label || product.platform, item: `${siteUrl}/#catalog` },
          { '@type': 'ListItem', position: 3, name: product.title, item: canonicalUrl },
        ],
      },
    ],
  };

  const noscriptContent = [
    '<noscript>',
    '  <main>',
    `    <h1>${escapeHtml(product.title)}</h1>`,
    `    <p>${escapeHtml(product.details.description)}</p>`,
    `    <p>Reusable GeeLark automation flow with unlimited runs. Price: $${product.price.toLocaleString('en-US')} USD.</p>`,
    '    <h2>Included in this workflow</h2>',
    `    <ul>${product.details.features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join('')}</ul>`,
    `    <p><a href="${siteUrl}/">Browse all GeeLark automation flows</a></p>`,
    '  </main>',
    '</noscript>',
  ].join('\n');

  let pageHtml = rootHtml
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonicalUrl}" />`)
    .replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonicalUrl}" />`)
    .replace(/<meta property="og:title"[^>]*>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description"[^>]*>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="twitter:title"[^>]*>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:description"[^>]*>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace('</head>', `    <script type="application/ld+json">${safeJson(structuredData)}</script>\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscriptContent}`);

  const outputDir = path.join(distDir, 'flows', product.id);
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'index.html'), pageHtml, 'utf8');
}

console.log(`SEO generated: ${sitemapUrls.length} URLs for ${siteUrl}`);
