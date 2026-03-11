// backend/user.js
// User watchlist helpers — backed by PostgreSQL
const db = require('./db');

async function getUserWatchlist(userId) {
  const result = await db.query('SELECT watchlist FROM user_watchlists WHERE user_id=$1', [userId]);
  return result.rows[0]?.watchlist ?? { digikey: [], mouser: [] };
}

async function setUserWatchlist(userId, watchlist) {
  await db.query(
    `INSERT INTO user_watchlists (user_id, watchlist, updated_at)
     VALUES ($1,$2,NOW())
     ON CONFLICT (user_id) DO UPDATE SET watchlist=$2, updated_at=NOW()`,
    [userId, JSON.stringify(watchlist)]
  );
}

module.exports = { getUserWatchlist, setUserWatchlist };
