export const PRODUCT_IMAGE_PATH = '/og.png';

export function buildMerchantProduct({ product, platform, siteUrl }) {
  const canonicalUrl = `${siteUrl}/flows/${product.id}/`;

  return {
    '@type': 'Product',
    name: product.title,
    image: [`${siteUrl}${PRODUCT_IMAGE_PATH}`],
    description: product.details.description,
    sku: product.id,
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
      seller: {
        '@type': 'Organization',
        name: 'GeeLark Flows',
        url: `${siteUrl}/`,
      },
    },
  };
}

export function buildCatalogStructuredData({ products, faqs, siteUrl }) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: 'GeeLark Flows',
        url: `${siteUrl}/`,
        description: 'Reusable GeeLark automation flows for social media, dating apps, mobile SEO, and account operations at scale.',
      },
      {
        '@type': 'ItemList',
        name: 'GeeLark Automation Flow Catalog',
        numberOfItems: products.length,
        itemListElement: products.map((product, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: product.title,
          url: `${siteUrl}/flows/${product.id}/`,
        })),
      },
      {
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
    ],
  };
}
