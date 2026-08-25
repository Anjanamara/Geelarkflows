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
const staticPages = [
  { url: `${siteUrl}/`, priority: '1.0', changefreq: 'weekly' },
  { url: `${siteUrl}/contact`, priority: '0.6', changefreq: 'monthly' },
  { url: `${siteUrl}/terms`, priority: '0.4', changefreq: 'monthly' },
  { url: `${siteUrl}/privacy`, priority: '0.4', changefreq: 'monthly' },
  { url: `${siteUrl}/refund-policy`, priority: '0.4', changefreq: 'monthly' },
  ...flowUrls.map((url) => ({ url, priority: '0.8', changefreq: 'monthly' })),
];

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...staticPages.map((page) => [
    '  <url>',
    `    <loc>${escapeHtml(page.url)}</loc>`,
    `    <lastmod>${lastModified}</lastmod>`,
    `    <changefreq>${page.changefreq}</changefreq>`,
    `    <priority>${page.priority}</priority>`,
    '  </url>',
  ].join('\n')),
  '</urlset>',
  '',
].join('\n');

await writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(path.join(distDir, 'sitemap.txt'), `${staticPages.map((p) => p.url).join('\n')}\n`, 'utf8');
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
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'GeeLark Flows',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: product.title,
            item: canonicalUrl,
          },
        ],
      },
    ],
  };

  const noscriptContent = [
    '<noscript>',
    '  <main>',
    `    <h1>${escapeHtml(product.title)}</h1>`,
    `    <p><strong>Platform:</strong> ${escapeHtml(product.platform)}</p>`,
    `    <p><strong>Price:</strong> $${product.price.toLocaleString('en-US')} USD</p>`,
    `    <p>${escapeHtml(product.details.description)}</p>`,
    '    <h2>Included Features</h2>',
    '    <ul>',
    ...(product.details.features || []).map((feature) => `      <li>${escapeHtml(feature)}</li>`),
    '    </ul>',
    `    <p><a href="${siteUrl}/">Back to all GeeLark automation flows</a></p>`,
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

// Helper to generate static prerender pages
async function generateStaticPage({ subPath, title, description, h1, bodyText }) {
  const canonicalUrl = `${siteUrl}/${subPath}`;
  const noscriptContent = [
    '<noscript>',
    '  <main>',
    `    <h1>${escapeHtml(h1)}</h1>`,
    `    <p>${escapeHtml(bodyText)}</p>`,
    '    <p>Official Contact: <a href="mailto:support@geelarkflows.com">support@geelarkflows.com</a></p>',
    `    <p><a href="${siteUrl}/">Return to GeeLark Flows Marketplace</a></p>`,
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
    .replace('<div id="root"></div>', `<div id="root"></div>\n    ${noscriptContent}`);

  const targetDir = path.join(distDir, subPath);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, 'index.html'), pageHtml, 'utf8');
}

// Generate Static Prerenders
await generateStaticPage({
  subPath: 'contact',
  title: 'Contact GeeLark Flow Automation Specialists | GeeLark Flows',
  description: 'Contact GeeLark Flows for reusable mobile automation, custom RPA development, account operations, setup, and technical support.',
  h1: 'Contact GeeLark Flows Support',
  bodyText: 'Direct assistance for orders, GeeLark setup coordination, and custom automation engineering.',
});

await generateStaticPage({
  subPath: 'terms',
  title: 'Terms of Service | GeeLark Flows',
  description: 'Terms governing the purchase, licensing, and usage of GeeLark automation workflow packages.',
  h1: 'Terms of Service',
  bodyText: 'Terms of Service governing the purchase, licensing, and operational usage of GeeLark automation workflows.',
});

await generateStaticPage({
  subPath: 'privacy',
  title: 'Privacy Policy | GeeLark Flows',
  description: 'How GeeLark Flows collects, processes, and protects customer emails, order records, and technical request data.',
  h1: 'Privacy Policy',
  bodyText: 'Privacy Policy describing limited personal and operational data processed by GeeLark Flows.',
});

await generateStaticPage({
  subPath: 'refund-policy',
  title: 'Refund & Cancellation Policy | GeeLark Flows',
  description: 'Policies regarding digital automation package delivery, GeeLark setup coordination, and cryptocurrency transaction handling.',
  h1: 'Refund & Cancellation Policy',
  bodyText: 'Refund and cancellation terms for digital automation deliverables and GeeLark Account Setup services.',
});

console.log(`SEO generated: ${staticPages.length} URLs for ${siteUrl}`);
