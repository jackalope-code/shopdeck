'use strict';

/**
 * API key encryption helpers — thin wrappers around tokenCrypto.js.
 *
 * API keys are stored in the api_keys JSONB column of user_profiles, encrypted
 * via tokenCrypto's encryptMap / decryptMap (AES-256-GCM, TOKEN_ENCRYPTION_KEY env var).
 *
 * Supported keys (stored as fields in the api_keys object):
 *   amazon_access_key    — Amazon PA API access key ID
 *   amazon_secret_key    — Amazon PA API secret access key
 *   amazon_partner_tag   — Amazon PA API partner tag (Associates tracking ID)
 *   cj_api_key           — Commission Junction affiliate API key
 *   walmart_impact_api_key — Walmart affiliate (Impact Radius) API key
 *   mouser_api_key       — Mouser Search API key
 *   digikey_client_id    — DigiKey OAuth2 client ID
 *   digikey_client_secret — DigiKey OAuth2 client secret
 *
 * Server-level fallback env vars (used when the user has no per-user key):
 *   CJ_API_KEY, WALMART_IMPACT_API_KEY, MOUSER_API_KEY,
 *   DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET,
 *   KROGER_CLIENT_ID, KROGER_CLIENT_SECRET,
 *   ITAD_API_KEY (optional free tier exists without it)
 */

const { encryptToken, decryptToken, encryptMap, decryptMap } = require('./tokenCrypto');

module.exports = { encryptToken, decryptToken, encryptMap, decryptMap };

