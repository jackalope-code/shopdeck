// backend/README.md

# Shopdeck Backend

## Overview
- Scrapes and caches data from Adafruit (newest products, sales), and user-specified Digikey/Mouser products/categories.
- Updates data once per day (schedule with cron or similar).
- Serves cached data and manages user watchlists via REST API.

## Files
- `scraper.js`: Scraping and caching logic.
- `userWatchlists.json`: Stores user-specific Digikey/Mouser watchlists.
- `server.js`: Express server for API endpoints.

## Usage
1. Run `node scraper.js` to update cache (schedule daily).
2. Run `node server.js` to start API server (default port 4000).
3. Use `/api/cache/:userId` to fetch cached data for a user.
4. Use `/api/watchlist/:userId` (POST) to update a user's watchlist.

## Note
- Replace placeholder scraping logic with real implementations for each source.
- Integrate with frontend for user watchlist management and data display.
