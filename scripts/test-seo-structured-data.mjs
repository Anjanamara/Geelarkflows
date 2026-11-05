import assert from 'node:assert/strict';
import fs from 'node:fs';
import { products, platforms } from '../src/data/products.js';
import { buildCatalogStructuredData, buildMerchantProduct, PRODUCT_IMAGE_PATH } from '../src/seo/structuredData.js';

const siteUrl = 'https://geelarkflows.com';
const image = fs.readFileSync(`public${PRODUCT_IMAGE_PATH}`);
assert.equal(image.toString('ascii', 1, 4), 'PNG', 'The merchant product image must be a real PNG file.');
const imageWidth = image.readUInt32BE(16);
const imageHeight = image.readUInt32BE(20);
assert(imageWidth * imageHeight >= 50000, 'The merchant product image must exceed Google\'s 50,000-pixel minimum.');

for (const product of products) {
  const platform = platforms.find((item) => item.id === product.platform);
  const merchantProduct = buildMerchantProduct({ product, platform, siteUrl });
  assert.equal(merchantProduct['@type'], 'Product');
  assert.equal(merchantProduct.name, product.title);
  assert.deepEqual(merchantProduct.image, [`${siteUrl}/og.png`], `${product.id} must provide a crawlable image.`);
  assert.equal(merchantProduct.sku, product.id, `${product.id} must provide a stable merchant SKU.`);
  assert.equal(merchantProduct.offers['@type'], 'Offer');
  assert.equal(merchantProduct.offers.price, product.price);
  assert.equal(merchantProduct.offers.priceCurrency, 'USD');
  assert.equal(merchantProduct.offers.availability, 'https://schema.org/InStock');
  assert.equal(merchantProduct.offers.itemCondition, 'https://schema.org/NewCondition');
  assert.equal(merchantProduct.offers.seller.name, 'GeeLark Flows');
}

const catalog = buildCatalogStructuredData({ products, faqs: [], siteUrl });
const itemList = catalog['@graph'].find((item) => item['@type'] === 'ItemList');
assert(itemList, 'The homepage must retain its catalog ItemList.');
assert(itemList.itemListElement.every((item) => item['@type'] === 'ListItem' && !item.item), 'The catalog must link to product pages without embedding merchant Product offers on a list page.');

console.log(`SEO structured-data checks passed for ${products.length} merchant product pages.`);
