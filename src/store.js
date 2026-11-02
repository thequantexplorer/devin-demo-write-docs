const seed = require('../data/seed.json');

function createStore({ now = () => new Date() } = {}) {
  let nextId = 1;
  const notes = new Map();

  function insert(fields, createdAt, updatedAt) {
    const note = {
      id: nextId++,
      title: fields.title,
      body: fields.body ?? '',
      tags: fields.tags ?? [],
      pinned: fields.pinned ?? false,
      createdAt,
      updatedAt,
    };
    notes.set(note.id, note);
    return note;
  }

  for (const s of seed) insert(s, s.createdAt, s.updatedAt);

  return {
    list({ tag, q, pinned } = {}) {
      const needle = q ? q.toLowerCase() : null;
      return [...notes.values()]
        .filter((n) => (tag ? n.tags.includes(tag) : true))
        .filter((n) => (pinned === undefined ? true : n.pinned === pinned))
        .filter((n) => (needle ? `${n.title}\n${n.body}`.toLowerCase().includes(needle) : true))
        .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id);
    },
    get(id) {
      return notes.get(id) ?? null;
    },
    create(fields) {
      const ts = now().toISOString();
      return insert(fields, ts, ts);
    },
    update(id, fields) {
      const note = notes.get(id);
      if (!note) return null;
      Object.assign(note, fields, { updatedAt: now().toISOString() });
      return note;
    },
    remove(id) {
      return notes.delete(id);
    },
  };
}

module.exports = { createStore };
