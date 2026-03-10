#!/usr/bin/env node
'use strict';
/**
 * backend/mcp/server.js
 * Standards-compliant MCP stdio server for ShopDeck.
 *
 * Usage:
 *   SHOPDECK_USER_ID=<userId> node backend/mcp/server.js
 *
 * Compatible with Claude Desktop and any MCP client that supports stdio transport.
 *
 * Permissions are read server-side from the user's aiConfig.mcpPermissions in
 * users.json — they are never taken from the client request, preventing
 * privilege escalation.
 */

const fs   = require('fs');
const path = require('path');
const { Server }               = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const tools = require('./tools');

const USERS_FILE = path.join(__dirname, '../users.json');

function readUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}

/** Read the user's server-side permission flags. Defaults to all-false if absent. */
function getServerPermissions(userId) {
  const user = readUsers().find(u => u.id === userId);
  return {
    projects:  false,
    inventory: false,
    watchlist: false,
    deals:     false,
    ...(user?.profile?.aiConfig?.mcpPermissions ?? {}),
  };
}

const TOOL_DEFS = [
  {
    name: 'get_projects',
    description:
      "Returns the user's ShopDeck build projects including name, status, budget, " +
      'amount spent, target sale price, estimated profit, and component count. ' +
      'Requires the "projects" permission to be granted in ShopDeck AI settings.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_inventory',
    description:
      "Returns a flat list of all components across all the user's build projects " +
      '(name, qty, notes, and which project each belongs to). ' +
      'Requires the "inventory" permission.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_watchlist',
    description:
      "Returns the user's DigiKey and Mouser watchlist items (product and category IDs). " +
      'Requires the "watchlist" permission.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_active_deals',
    description:
      "Triggers a fresh scrape of the user's active-deals feed sources and returns results. " +
      'Respects a 1-minute per-host cooldown and a 5 calls/hour per-user cap. ' +
      'Requires the "deals" permission.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
];

async function main() {
  const userId = process.env.SHOPDECK_USER_ID;
  if (!userId) {
    process.stderr.write(
      'Error: SHOPDECK_USER_ID environment variable is required.\n' +
      'Usage: SHOPDECK_USER_ID=<userId> node backend/mcp/server.js\n'
    );
    process.exit(1);
  }

  if (!readUsers().find(u => u.id === userId)) {
    process.stderr.write(`Error: No user found with id "${userId}" in users.json.\n`);
    process.exit(1);
  }

  const server = new Server(
    { name: 'shopdeck-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    // Re-read permissions on every call so live changes in the app take effect immediately
    const permissions = getServerPermissions(userId);

    let result;
    try {
      if (name === 'get_projects') {
        result = await tools.getProjects(userId, permissions);
      } else if (name === 'get_inventory') {
        result = await tools.getInventory(userId, permissions);
      } else if (name === 'get_watchlist') {
        result = await tools.getWatchlist(userId, permissions);
      } else if (name === 'get_active_deals') {
        result = await tools.getActiveDeals(userId, permissions, null);
      } else {
        return {
          content: [{ type: 'text', text: `Unknown tool: "${name}"` }],
          isError: true,
        };
      }
    } catch (err) {
      return { content: [{ type: 'text', text: err.message }], isError: true };
    }

    if (result === null) {
      return {
        content: [{
          type: 'text',
          text:
            `Permission denied: the "${name}" tool requires a permission that has not ` +
            'been granted. Go to ShopDeck → AI Assistant → Data Access to enable it.',
        }],
        isError: true,
      };
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
