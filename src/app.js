const express = require('express');
const { createStore } = require('./store');
const { requireToken } = require('./auth');
const { notFound, errorHandler } = require('./errors');
const { checkNote, intParam, boolParam } = require('./validate');

function noteId(req) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw notFound(`Note ${req.params.id} not found`);
  return id;
}

function createApp({ store = createStore() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/notes', (req, res) => {
    const limit = intParam(req.query.limit, 'limit', { min: 1, max: 100, fallback: 20 });
    const offset = intParam(req.query.offset, 'offset', { min: 0, max: 1000000, fallback: 0 });
    const pinned = boolParam(req.query.pinned, 'pinned');
    const all = store.list({ tag: req.query.tag, q: req.query.q, pinned });
    res.json({ data: all.slice(offset, offset + limit), total: all.length, limit, offset });
  });

  app.post('/notes', requireToken, (req, res) => {
    const note = store.create(checkNote(req.body, { partial: false }));
    res.status(201).location(`/notes/${note.id}`).json(note);
  });

  app.get('/notes/:id', (req, res) => {
    const id = noteId(req);
    const note = store.get(id);
    if (!note) throw notFound(`Note ${id} not found`);
    res.json(note);
  });

  app.patch('/notes/:id', requireToken, (req, res) => {
    const id = noteId(req);
    if (!store.get(id)) throw notFound(`Note ${id} not found`);
    res.json(store.update(id, checkNote(req.body, { partial: true })));
  });

  app.delete('/notes/:id', requireToken, (req, res) => {
    const id = noteId(req);
    if (!store.remove(id)) throw notFound(`Note ${id} not found`);
    res.status(204).end();
  });

  app.use((req, res, next) => next(notFound(`No route for ${req.method} ${req.path}`)));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
