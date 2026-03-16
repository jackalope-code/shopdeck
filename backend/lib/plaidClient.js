// backend/lib/plaidClient.js
// Plaid API client singleton.
// Returns null / false when Plaid env vars are not configured so that callers
// can gracefully degrade without crashing.
const { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } = require('plaid');

function isPlaidConfigured() {
  const { PLAID_CLIENT_ID, PLAID_SECRET } = process.env;
  const env = process.env.PLAID_ENV || (process.env.NODE_ENV === 'development' ? 'sandbox' : '');
  return !!(PLAID_CLIENT_ID && PLAID_SECRET && env);
}

// Lazily-created singleton — avoids constructing the client when Plaid is not configured.
let _client = null;

function getPlaidClient() {
  if (_client) return _client;
  const { PLAID_CLIENT_ID, PLAID_SECRET } = process.env;
  const plaidEnv = process.env.PLAID_ENV || (process.env.NODE_ENV === 'development' ? 'sandbox' : null);
  if (!PLAID_CLIENT_ID || !PLAID_SECRET || !plaidEnv) {
    throw new Error('Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV.');
  }
  const config = new Configuration({
    basePath: PlaidEnvironments[plaidEnv],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET,
      },
    },
  });
  _client = new PlaidApi(config);
  return _client;
}

module.exports = { isPlaidConfigured, getPlaidClient, Products, CountryCode };
