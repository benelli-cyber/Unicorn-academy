'use strict';
/**
 * Unicorn Academy – Express server.
 *
 *   GET    /                        the app (public/index.html)
 *   GET    /api/status              { homework: true|false, maxImages, appVersion }
 *   GET    /api/riders              [{ id, name, uni, updatedAt }]
 *   POST   /api/riders              → { id } (a new, empty rider)
 *   GET    /api/riders/:id/state    → { state, updatedAt }
 *   PUT    /api/riders/:id/state    { state, updatedAt } → { ok, updatedAt } (409 if a newer save exists)
 *   DELETE /api/riders/:id
 *   POST   /api/homework            { images: [{ mediaType, data }], plan } → problems, hints, warm-ups
 *   GET    /api/health              simple status check
 *
 * Run directly (`node server/index.js`) to start the server. Tests import
 * createApp() and pass in their own stores instead.
 */
const path = require('path');
const express = require('express');
const { loadConfig, ROOT } = require('./config');
const { RiderStore, RiderError } = require('./riders');
const { HomeworkReader, HomeworkError, MAX_IMAGES } = require('./homework');
const pkg = require('../package.json');

// Changes every time the server starts, so open pages can tell an update happened.
const APP_VERSION = `${pkg.version}-${Date.now().toString(36)}`;

/**
 * @param {object} deps
 * @param {RiderStore} deps.riders
 * @param {HomeworkReader} deps.homework
 */
function createApp({ riders, homework }) {
  const app = express();
  app.disable('x-powered-by');

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // JSON bodies only, so another website can't post to this app from your browser.
  const smallJson = express.json({ limit: '512kb' });
  const photoJson = express.json({ limit: '30mb' });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.get('/api/status', (req, res) => res.json({ homework: homework.enabled, maxImages: MAX_IMAGES, appVersion: APP_VERSION }));

  app.get('/api/riders', (req, res) => res.json(riders.list()));
  app.post('/api/riders', smallJson, (req, res) => res.status(201).json(riders.create()));
  app.get('/api/riders/:id/state', (req, res) => res.json(riders.get(req.params.id)));
  app.put('/api/riders/:id/state', smallJson, (req, res) => {
    const body = req.body || {};
    res.json(riders.put(req.params.id, body.state, Number(body.updatedAt)));
  });
  app.delete('/api/riders/:id', (req, res) => {
    riders.remove(req.params.id);
    res.status(204).end();
  });

  app.post('/api/homework', photoJson, async (req, res, next) => {
    try {
      const body = req.body || {};
      res.json(await homework.read({ images: body.images, plan: body.plan }));
    } catch (err) {
      next(err);
    }
  });

  app.use(express.static(path.join(ROOT, 'public'), { index: 'index.html', maxAge: 0 }));

  // Errors → JSON. Known errors keep their status; anything else is a 500.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof RiderError) return res.status(err.status).json({ error: err.message, ...(err.extra || {}) });
    if (err instanceof HomeworkError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_big', message: 'Upload is too large' } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Bad JSON' });
    console.error('Unexpected error:', err.message);
    res.status(500).json({ error: 'Server error' });
  });

  return app;
}

if (require.main === module) {
  const cfg = loadConfig();
  const riders = new RiderStore(path.join(cfg.dataDir, 'unicorn-academy.db'));
  const homework = new HomeworkReader({ apiKey: cfg.anthropicApiKey, model: cfg.model });
  const app = createApp({ riders, homework });
  app.listen(cfg.port, () => {
    console.log(`Unicorn Academy on http://localhost:${cfg.port}/ (homework photos ${homework.enabled ? 'on, model ' + cfg.model : 'off: no API key in config.json'})`);
  });
}

module.exports = { createApp };
