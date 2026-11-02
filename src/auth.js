const { ApiError } = require('./errors');

const DEFAULT_TOKEN = 'dev-token';

function apiToken() {
  return process.env.NOTES_API_TOKEN || DEFAULT_TOKEN;
}

function requireToken(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(new ApiError(401, 'unauthorized', 'Missing bearer token'));
  }
  if (token !== apiToken()) {
    return next(new ApiError(401, 'unauthorized', 'Invalid bearer token'));
  }
  next();
}

module.exports = { requireToken, apiToken, DEFAULT_TOKEN };
