// backend/user.js
// User model and helpers for electronics watchlist

const fs = require('fs');
const path = require('path');

const userWatchlistsPath = path.join(__dirname, 'userWatchlists.json');

function getUserWatchlist(userId) {
  if (!fs.existsSync(userWatchlistsPath)) return null;
  const userWatchlists = JSON.parse(fs.readFileSync(userWatchlistsPath, 'utf-8'));
  return userWatchlists[userId] || { digikey: [], mouser: [] };
}

function setUserWatchlist(userId, watchlist) {
  let userWatchlists = {};
  if (fs.existsSync(userWatchlistsPath)) {
    userWatchlists = JSON.parse(fs.readFileSync(userWatchlistsPath, 'utf-8'));
  }
  userWatchlists[userId] = watchlist;
  fs.writeFileSync(userWatchlistsPath, JSON.stringify(userWatchlists, null, 2));
}

module.exports = { getUserWatchlist, setUserWatchlist };
