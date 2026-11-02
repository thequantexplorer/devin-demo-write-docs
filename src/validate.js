const { validationError } = require('./errors');

const FIELDS = ['title', 'body', 'tags', 'pinned'];
const TAG_PATTERN = /^[a-z0-9-]{1,20}$/;

function checkNote(input, { partial }) {
  const problems = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw validationError([{ field: '(body)', message: 'must be a JSON object' }]);
  }

  for (const key of Object.keys(input)) {
    if (!FIELDS.includes(key)) problems.push({ field: key, message: 'is not a known field' });
  }

  if (!partial || 'title' in input) {
    const title = typeof input.title === 'string' ? input.title.trim() : input.title;
    if (typeof title !== 'string' || title.length === 0) {
      problems.push({ field: 'title', message: 'is required' });
    } else if (title.length > 120) {
      problems.push({ field: 'title', message: 'must be 120 characters or fewer' });
    }
  }

  if ('body' in input) {
    if (typeof input.body !== 'string') problems.push({ field: 'body', message: 'must be a string' });
    else if (input.body.length > 10000) problems.push({ field: 'body', message: 'must be 10000 characters or fewer' });
  }

  if ('tags' in input) {
    if (!Array.isArray(input.tags)) {
      problems.push({ field: 'tags', message: 'must be an array of strings' });
    } else if (input.tags.length > 5) {
      problems.push({ field: 'tags', message: 'can have at most 5 tags' });
    } else if (!input.tags.every((t) => typeof t === 'string' && TAG_PATTERN.test(t))) {
      problems.push({ field: 'tags', message: 'each tag must be 1-20 characters: a-z, 0-9 or -' });
    }
  }

  if ('pinned' in input && typeof input.pinned !== 'boolean') {
    problems.push({ field: 'pinned', message: 'must be true or false' });
  }

  if (partial && Object.keys(input).length === 0) {
    problems.push({ field: '(body)', message: 'must contain at least one field' });
  }

  if (problems.length) throw validationError(problems);

  const clean = {};
  if ('title' in input) clean.title = input.title.trim();
  if ('body' in input) clean.body = input.body;
  if ('tags' in input) clean.tags = [...new Set(input.tags)];
  if ('pinned' in input) clean.pinned = input.pinned;
  return clean;
}

function intParam(value, name, { min, max, fallback }) {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!/^\d+$/.test(String(value)) || n < min || n > max) {
    throw validationError([{ field: name, message: `must be a whole number from ${min} to ${max}` }]);
  }
  return n;
}

function boolParam(value, name) {
  if (value === undefined) return undefined;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw validationError([{ field: name, message: 'must be true or false' }]);
}

module.exports = { checkNote, intParam, boolParam };
