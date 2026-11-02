class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function notFound(message = 'Not found') {
  return new ApiError(404, 'not_found', message);
}

function validationError(details) {
  return new ApiError(400, 'validation_error', 'Request is not valid', details);
}

function errorHandler(err, req, res, next) {
  if (err.type === 'entity.parse.failed') {
    err = new ApiError(400, 'invalid_json', 'Request body is not valid JSON');
  } else if (err.type === 'entity.too.large') {
    err = new ApiError(413, 'payload_too_large', 'Request body is larger than 100kb');
  }
  if (!(err instanceof ApiError)) {
    console.error(err);
    err = new ApiError(500, 'internal_error', 'Something went wrong');
  }
  const body = { error: { code: err.code, message: err.message } };
  if (err.details) body.error.details = err.details;
  res.status(err.status).json(body);
}

module.exports = { ApiError, notFound, validationError, errorHandler };
