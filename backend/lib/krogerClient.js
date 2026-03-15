'use strict';

/**
 * Kroger Developer API client.
 *
 * OAuth2 client_credentials flow. Access tokens are cached in-process until expiry.
 *
 * Env vars required:
 *   KROGER_CLIENT_ID     - OAuth2 client ID
 *   KROGER_CLIENT_SECRET - OAuth2 client secret
 *
 * Documentation: https://developer.kroger.com/documentation/public/
 *
 * Required rule options (at least one):
 *   keywords      {string}  - Product search term
 *
 * Optional rule options:
 *   department    {string}  - Kroger department filter (e.g. 'produce', 'meat-seafood')
 *   locationId    {string}  - Kroger store location ID (defaults to a broad search)
 *   onSale        {boolean} - Filter to on-sale items only
 *   limit         {number}  - Max results (default: 20, max: 50)
 */

const TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';
const PRODUCTS_URL = 'https://api.kroger.com/v1/products';

// In-process token cache
let _cachedToken = null;
let _tokenExpiresAt = 0;

async function getKrogerToken() {
  if (_cachedToken && Date.now() < _tokenExpiresAt - 30_000) {
    return _cachedToken;
  }

  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Kroger API not configured (KROGER_CLIENT_ID and KROGER_CLIENT_SECRET env vars required)');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=product.compact',
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Kroger OAuth2 error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  _cachedToken = data.access_token;
  _tokenExpiresAt = Date.now() + (data.expires_in ?? 1800) * 1000;
  return _cachedToken;
}

async function scrapeKrogerApi(opts = {}, _mode = 'scheduled', _context = {}) {
  const { keywords, department, locationId, onSale, limit = 20 } = opts;

  const token = await getKrogerToken();

  const params = new URLSearchParams({
    'filter.limit': String(Math.min(Number(limit) || 20, 50)),
  });
  if (keywords) params.set('filter.term', keywords);
  if (department) params.set('filter.department', department);
  if (locationId) params.set('filter.locationId', locationId);
  if (onSale) params.set('filter.on_sale', 'true');

  const url = `${PRODUCTS_URL}?${params.toString()}`;

  let body;
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      // Token may have expired — clear the cache so next call re-authenticates
      if (res.status === 401) {
        _cachedToken = null;
        _tokenExpiresAt = 0;
      }
      const text = await res.text().catch(() => '');
      throw new Error(`Kroger Products API error ${res.status}: ${text.slice(0, 200)}`);
    }
    body = await res.json();
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      throw new Error('Kroger API request timed out');
    }
    throw err;
  }

  const products = body?.data ?? [];
  return products.map(p => {
    const priceInfo = p.items?.[0]?.price;
    const price     = priceInfo?.promo ?? priceInfo?.regular;
    const compareAt = priceInfo?.promo != null ? priceInfo.regular : undefined;
    const imgSet    = p.images?.find(img => img.perspective === 'front')?.sizes ?? p.images?.[0]?.sizes ?? [];
    const image     = imgSet.find(s => s.size === 'medium')?.url ?? imgSet[0]?.url;

    return {
      name:         p.description ?? '',
      price:        price != null ? String(price) : undefined,
      comparePrice: compareAt != null ? String(compareAt) : undefined,
      image,
      vendor:       'Kroger',
    };
  }).filter(i => i.name);
}

module.exports = { scrapeKrogerApi };
