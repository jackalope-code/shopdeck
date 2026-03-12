// backend/routes/ai.js
// Proxy route for AI shopping assistant — shields API keys on the client.
// Supported providers: openai, anthropic, gemini, ollama, github, opencode
'use strict';

const express = require('express');
const router = express.Router();
const axios = require('axios');
const { verifyToken } = require('../middleware/auth');
const db = require('../db');
const { decryptToken } = require('../lib/tokenCrypto');

// POST /api/ai/chat
// Body: { provider, model, apiKey, messages: [{role, content}], context? }
router.post('/chat', verifyToken, async (req, res) => {
  const { provider, model, apiKey, messages, context } = req.body;

  if (!provider || !messages?.length) {
    return res.status(400).json({ error: 'provider and messages are required' });
  }

  // Prepend a system message with ShopDeck context if provided
  const systemContent = context
    ? `You are ShopDeck's AI shopping assistant. Context about the user's current view:\n${context}\n\nHelp the user make smart purchasing decisions, find deals, and manage their inventory.`
    : "You are ShopDeck's AI shopping assistant. Help the user make smart purchasing decisions, find deals, and manage their inventory.";

  const fullMessages = [{ role: 'system', content: systemContent }, ...messages];

  try {
    let reply = '';

    // ── OpenAI ─────────────────────────────────────────────────────────────────
    if (provider === 'openai') {
      if (!apiKey) return res.status(400).json({ error: 'apiKey required for OpenAI' });
      const r = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        { model: model || 'gpt-4o', messages: fullMessages },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30_000 }
      );
      reply = r.data.choices?.[0]?.message?.content ?? '';
    }

    // ── Anthropic ──────────────────────────────────────────────────────────────
    else if (provider === 'anthropic') {
      if (!apiKey) return res.status(400).json({ error: 'apiKey required for Anthropic' });
      // Anthropic uses a separate system field, messages must be user/assistant only
      const anthropicMessages = fullMessages.filter(m => m.role !== 'system');
      const system = fullMessages.find(m => m.role === 'system')?.content ?? '';
      const r = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: model || 'claude-opus-4-5',
          max_tokens: 1024,
          system,
          messages: anthropicMessages,
        },
        {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          timeout: 30_000,
        }
      );
      reply = r.data.content?.[0]?.text ?? '';
    }

    // ── Google Gemini ──────────────────────────────────────────────────────────
    else if (provider === 'gemini') {
      if (!apiKey) return res.status(400).json({ error: 'apiKey required for Gemini' });
      const geminiModel = model || 'gemini-2.0-flash';
      // Convert OpenAI-style messages to Gemini parts
      const contents = fullMessages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
      // Inject system as first user turn if present
      const systemMsg = fullMessages.find(m => m.role === 'system');
      if (systemMsg) contents.unshift({ role: 'user', parts: [{ text: systemMsg.content }] });
      const r = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
        { contents },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30_000 }
      );
      reply = r.data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    }

    // ── Ollama (local) ─────────────────────────────────────────────────────────
    else if (provider === 'ollama') {
      const ollamaBase = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
      const r = await axios.post(
        `${ollamaBase}/api/chat`,
        { model: model || 'llama3', messages: fullMessages, stream: false },
        { headers: { 'Content-Type': 'application/json' }, timeout: 60_000 }
      );
      reply = r.data.message?.content ?? '';
    }

    // ── GitHub Copilot (GitHub Models API — OAuth token from Device Flow) ────────
    else if (provider === 'github') {
      const result = await db.query('SELECT github_token FROM users WHERE id=$1', [req.user.id]);
      const ghToken = decryptToken(result.rows[0]?.github_token);
      if (!ghToken) {
        return res.status(401).json({
          error: 'GitHub account not connected. Go to Settings → AI Assistant to connect your GitHub account via OAuth.',
        });
      }
      const r = await axios.post(
        'https://models.inference.ai.azure.com/chat/completions',
        { model: model || 'gpt-4.1', messages: fullMessages },
        { headers: { Authorization: `Bearer ${ghToken}`, 'Content-Type': 'application/json' }, timeout: 30_000 }
      );
      reply = r.data.choices?.[0]?.message?.content ?? '';
    }

    // ── OpenCode.ai ────────────────────────────────────────────────────────────
    else if (provider === 'opencode') {
      if (!apiKey) return res.status(400).json({ error: 'apiKey required for OpenCode' });
      const r = await axios.post(
        'https://api.opencode.ai/v1/chat/completions',
        { model: model || 'opencode-default', messages: fullMessages },
        { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30_000 }
      );
      reply = r.data.choices?.[0]?.message?.content ?? '';
    }

    else {
      return res.status(400).json({ error: `Unknown provider: "${provider}"` });
    }

    res.json({ reply });
  } catch (err) {
    const status = err.response?.status ?? 500;
    const message = err.response?.data?.error?.message ?? err.message ?? 'AI request failed';
    res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

module.exports = router;
