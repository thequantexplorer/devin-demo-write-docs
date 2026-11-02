const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp } = require('../src/app');
const { createStore } = require('../src/store');

const AUTH = { authorization: 'Bearer dev-token' };

async function startServer() {
  const store = createStore({ now: () => new Date('2026-02-01T12:00:00.000Z') });
  const server = createApp({ store }).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, { body, headers = {} } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return { call, close: () => new Promise((resolve) => server.close(resolve)) };
}

test('GET /health', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('GET', '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, { status: 'ok' });
});

test('GET /notes lists seed notes, pinned first', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('GET', '/notes');
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 3);
  assert.equal(res.body.limit, 20);
  assert.equal(res.body.offset, 0);
  assert.deepEqual(res.body.data.map((n) => n.id), [1, 3, 2]);
});

test('GET /notes filters by tag, q and pinned, and paginates', async (t) => {
  const api = await startServer();
  t.after(api.close);
  assert.deepEqual((await api.call('GET', '/notes?tag=work')).body.data.map((n) => n.id), [3]);
  assert.deepEqual((await api.call('GET', '/notes?q=COFFEE')).body.data.map((n) => n.id), [2]);
  assert.deepEqual((await api.call('GET', '/notes?pinned=true')).body.data.map((n) => n.id), [1]);
  const page = await api.call('GET', '/notes?limit=1&offset=1');
  assert.equal(page.body.total, 3);
  assert.deepEqual(page.body.data.map((n) => n.id), [3]);
  const bad = await api.call('GET', '/notes?limit=500');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'validation_error');
});

test('POST /notes creates a note', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('POST', '/notes', { headers: AUTH, body: { title: '  Call the dentist ', tags: ['personal'] } });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('location'), '/notes/4');
  assert.deepEqual(res.body, {
    id: 4,
    title: 'Call the dentist',
    body: '',
    tags: ['personal'],
    pinned: false,
    createdAt: '2026-02-01T12:00:00.000Z',
    updatedAt: '2026-02-01T12:00:00.000Z',
  });
});

test('POST /notes needs a valid bearer token', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const none = await api.call('POST', '/notes', { body: { title: 'x' } });
  assert.equal(none.status, 401);
  assert.equal(none.body.error.code, 'unauthorized');
  const wrong = await api.call('POST', '/notes', { headers: { authorization: 'Bearer nope' }, body: { title: 'x' } });
  assert.equal(wrong.status, 401);
});

test('POST /notes rejects bad input', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('POST', '/notes', { headers: AUTH, body: { title: '', tags: ['Bad Tag'], color: 'red' } });
  assert.equal(res.status, 400);
  assert.equal(res.body.error.code, 'validation_error');
  assert.deepEqual(res.body.error.details.map((d) => d.field).sort(), ['color', 'tags', 'title']);
  const json = await api.call('POST', '/notes', { headers: AUTH, body: '{"title":' });
  assert.equal(json.status, 400);
  assert.equal(json.body.error.code, 'invalid_json');
});

test('GET /notes/:id', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('GET', '/notes/2');
  assert.equal(res.status, 200);
  assert.equal(res.body.title, 'Groceries');
  const missing = await api.call('GET', '/notes/99');
  assert.equal(missing.status, 404);
  assert.deepEqual(missing.body, { error: { code: 'not_found', message: 'Note 99 not found' } });
});

test('PATCH /notes/:id updates only the given fields', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('PATCH', '/notes/2', { headers: AUTH, body: { pinned: true } });
  assert.equal(res.status, 200);
  assert.equal(res.body.pinned, true);
  assert.equal(res.body.title, 'Groceries');
  assert.equal(res.body.updatedAt, '2026-02-01T12:00:00.000Z');
  const empty = await api.call('PATCH', '/notes/2', { headers: AUTH, body: {} });
  assert.equal(empty.status, 400);
  const noAuth = await api.call('PATCH', '/notes/2', { body: { pinned: false } });
  assert.equal(noAuth.status, 401);
});

test('DELETE /notes/:id', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('DELETE', '/notes/3', { headers: AUTH });
  assert.equal(res.status, 204);
  assert.equal((await api.call('GET', '/notes/3')).status, 404);
  assert.equal((await api.call('DELETE', '/notes/3', { headers: AUTH })).status, 404);
});

test('unknown routes return a JSON 404', async (t) => {
  const api = await startServer();
  t.after(api.close);
  const res = await api.call('GET', '/nope');
  assert.equal(res.status, 404);
  assert.equal(res.body.error.code, 'not_found');
});
