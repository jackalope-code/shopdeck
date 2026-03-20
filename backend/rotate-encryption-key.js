// backend/rotate-encryption-key.js
// Offline key-rotation script — re-encrypts all stored credentials from
// OLD_TOKEN_ENCRYPTION_KEY to NEW_TOKEN_ENCRYPTION_KEY in a single transaction.
//
// Run on the server directly (NOT via an HTTP route):
//
//   OLD_TOKEN_ENCRYPTION_KEY=<64-char hex> \
//   NEW_TOKEN_ENCRYPTION_KEY=<64-char hex> \
//   node backend/rotate-encryption-key.js
//
// After a successful run, update TOKEN_ENCRYPTION_KEY in your secrets manager / .env
// to the new value before restarting the application server.
'use strict';

const { Pool } = require('pg');
const { rotateEncryptedValues } = require('./lib/tokenCrypto');

const OLD_KEY = process.env.OLD_TOKEN_ENCRYPTION_KEY;
const NEW_KEY = process.env.NEW_TOKEN_ENCRYPTION_KEY;

if (!OLD_KEY || OLD_KEY.length !== 64) {
  console.error('ERROR: OLD_TOKEN_ENCRYPTION_KEY must be a 64-character hex string.');
  process.exit(1);
}
if (!NEW_KEY || NEW_KEY.length !== 64) {
  console.error('ERROR: NEW_TOKEN_ENCRYPTION_KEY must be a 64-character hex string.');
  process.exit(1);
}
if (OLD_KEY === NEW_KEY) {
  console.error('ERROR: OLD_TOKEN_ENCRYPTION_KEY and NEW_TOKEN_ENCRYPTION_KEY are identical — nothing to do.');
  process.exit(1);
}

const pool = new Pool({
  host:     process.env.POSTGRES_HOST     || process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10),
  database: process.env.POSTGRES_DB       || process.env.DB_NAME     || 'shopdeck',
  user:     process.env.POSTGRES_USER     || process.env.DB_USER     || 'shopdeck',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'shopdeck',
});

async function rotate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── users.github_token ────────────────────────────────────────────────────
    const { rows: userRows } = await client.query(
      'SELECT id, github_token FROM users WHERE github_token IS NOT NULL'
    );
    let githubRotated = 0;
    for (const row of userRows) {
      if (row.github_token.split(':').length !== 3) continue; // skip non-encrypted
      const [rotated] = rotateEncryptedValues([row.github_token], OLD_KEY, NEW_KEY);
      await client.query('UPDATE users SET github_token=$1 WHERE id=$2', [rotated, row.id]);
      githubRotated++;
    }

    // ── user_profiles.api_keys ────────────────────────────────────────────────
    const { rows: profileRows } = await client.query(
      "SELECT user_id, api_keys FROM user_profiles WHERE api_keys IS NOT NULL AND api_keys::text != '{}'"
    );
    let apiKeyProfilesRotated = 0;
    for (const row of profileRows) {
      const rotated = {};
      let changed = false;
      for (const [k, v] of Object.entries(row.api_keys)) {
        if (v && typeof v === 'string' && v.split(':').length === 3) {
          [rotated[k]] = rotateEncryptedValues([v], OLD_KEY, NEW_KEY);
          changed = true;
        } else {
          rotated[k] = v;
        }
      }
      if (!changed) continue;
      await client.query(
        'UPDATE user_profiles SET api_keys=$1::jsonb WHERE user_id=$2',
        [JSON.stringify(rotated), row.user_id]
      );
      apiKeyProfilesRotated++;
    }

    // ── user_profiles.ai_config.apiKey ────────────────────────────────────────
    const { rows: aiRows } = await client.query(
      "SELECT user_id, ai_config FROM user_profiles " +
      "WHERE ai_config IS NOT NULL AND (ai_config->>'apiKey') IS NOT NULL AND (ai_config->>'apiKey') != ''"
    );
    let aiKeyRotated = 0;
    for (const row of aiRows) {
      const encKey = row.ai_config?.apiKey;
      if (!encKey || encKey.split(':').length !== 3) continue;
      const [rotatedKey] = rotateEncryptedValues([encKey], OLD_KEY, NEW_KEY);
      const updated = { ...row.ai_config, apiKey: rotatedKey };
      await client.query(
        'UPDATE user_profiles SET ai_config=$1::jsonb WHERE user_id=$2',
        [JSON.stringify(updated), row.user_id]
      );
      aiKeyRotated++;
    }

    // ── plaid_items.access_token_enc ──────────────────────────────────────────
    const { rows: plaidRows } = await client.query(
      'SELECT id, access_token_enc FROM plaid_items WHERE access_token_enc IS NOT NULL'
    );
    let plaidRotated = 0;
    for (const row of plaidRows) {
      if (row.access_token_enc.split(':').length !== 3) continue;
      const [rotated] = rotateEncryptedValues([row.access_token_enc], OLD_KEY, NEW_KEY);
      await client.query('UPDATE plaid_items SET access_token_enc=$1 WHERE id=$2', [rotated, row.id]);
      plaidRotated++;
    }

    await client.query('COMMIT');

    console.log('Key rotation complete:');
    console.log(`  github_token:        ${githubRotated} row(s)`);
    console.log(`  api_keys profiles:   ${apiKeyProfilesRotated} profile(s)`);
    console.log(`  ai_config.apiKey:    ${aiKeyRotated} row(s)`);
    console.log(`  plaid access tokens: ${plaidRotated} row(s)`);
    console.log('');
    console.log('Next step: update TOKEN_ENCRYPTION_KEY to the new value in your secrets manager / .env,');
    console.log('then restart the application server.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Rotation FAILED — transaction rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

rotate();
