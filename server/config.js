'use strict';
/**
 * Loads config.json (git-ignored) from the project folder.
 *
 *   port             web port (default 8081, next to the Family Dashboard on 8080)
 *   anthropicApiKey  Anthropic API key for reading homework photos. Optional:
 *                    leave it empty and Homework Helper offers "pick the topic" only.
 *   model            Claude model used for homework photos
 *
 * Environment variables win over the file: PORT, ANTHROPIC_API_KEY, DATA_DIR.
 * The API key is a secret: it is never logged and never sent to the browser.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEFAULTS = { port: 8081, anthropicApiKey: '', model: 'claude-opus-5-5' };

function loadConfig(file = process.env.CONFIG_PATH || path.join(ROOT, 'config.json')) {
  let fromFile = {};
  if (fs.existsSync(file)) {
    try {
      fromFile = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      throw new Error(`Could not read ${file}: ${err.message}`);
    }
  }
  const cfg = { ...DEFAULTS, ...fromFile };
  if (process.env.PORT) cfg.port = Number(process.env.PORT);
  if (process.env.ANTHROPIC_API_KEY) cfg.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  cfg.port = Number.isInteger(cfg.port) && cfg.port > 0 && cfg.port < 65536 ? cfg.port : DEFAULTS.port;
  cfg.anthropicApiKey = typeof cfg.anthropicApiKey === 'string' ? cfg.anthropicApiKey.trim() : '';
  cfg.model = typeof cfg.model === 'string' && cfg.model.trim() ? cfg.model.trim() : DEFAULTS.model;
  cfg.dataDir = process.env.DATA_DIR || path.join(ROOT, 'data');
  return cfg;
}

module.exports = { loadConfig, ROOT, DEFAULTS };
