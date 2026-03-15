'use strict';

/**
 * CJ Affiliate Product Catalog API client (Commission Junction).
 *
 * Endpoint: GET https://product-search.api.cj.com/v2/product-search
 *
 * Auth: API key in Authorization header.
 *   - Server-side: CJ_API_KEY environment variable (operator joins CJ once).
 *   - Per-user: context.apiKeys.cj_api_key for users with their own affiliate accounts.
 *
 * Required rule options:
 *   keywords     {string}  - Search terms
 *
 * Optional rule options:
 *   advertiserIds {string} - Comma-separated CJ advertiser IDs (retailer filter)
 *   lowPrice      {number} - Minimum price filter (USD)
 *   highPrice     {number} - Maximum price filter (USD)
 *   inStock       {boolean}- Filter to in-stock items only (default: true)
 *   limit         {number} - Max results to return (default: 20, max: 100)
 *
 * Returns normalized items with: name, price, url, image, availability, vendor.
 */

const CJ_SEARCH_ENDPOINT = 'https://product-search.api.cj.com/v2/product-search';

async function scrapeCjApi(opts = {}, _mode = 'scheduled', context = {}) {
  const apiKey = context?.apiKeys?.cj_api_key || process.env.CJ_API_KEY;
  if (!apiKey) {
    throw new Error('CJ API key not configured (CJ_API_KEY env var or cj_api_key in API Keys settings)');
  }

  const { keywords, advertiserIds, lowPrice, highPrice, inStock = true, limit = 20 } = opts;
  if (!keywords) throw new Error('cj-api requires opts.keywords');

  const params = new URLSearchParams({
    keywords,
    'records-per-page': String(Math.min(Number(limit) || 20, 100)),
  });
  if (advertiserIds) params.set('advertiser-ids', advertiserIds);
  if (lowPrice != null) params.set('low-price', String(lowPrice));
  if (highPrice != null) params.set('high-price', String(highPrice));
  if (inStock) params.set('instock', 'yes');

  const url = `${CJ_SEARCH_ENDPOINT}?${params.toString()}`;

  let body;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`CJ API error ${res.status}: ${text.slice(0, 200)}`);
    }
    body = await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('CJ API request timed out');
    }
    throw err;
  }

  const products = body?.products?.product ?? [];
  return products.map(p => ({
    name:         p.name ?? '',
    price:        p['sale-price'] != null ? String(p['sale-price']) : p.price != null ? String(p.price) : undefined,
    comparePrice: p.price != null && p['sale-price'] != null ? String(p.price) : undefined,
    url:          p['buy-url'] ?? p.link ?? undefined,
    image:        p['image-url'] ?? undefined,
    availability: p['instock'] === 'yes' ? 'in_stock' : p['instock'] === 'no' ? 'out_of_stock' : undefined,
    vendor:       p['advertiser-name'] ?? undefined,
  })).filter(i => i.name);
}

module.exports = { scrapeCjApi };
