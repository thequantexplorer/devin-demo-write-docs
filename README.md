# notes-api

A small REST API for notes, built with [Express](https://expressjs.com/). You can list, search, create, read, update and delete notes. Each note has a title, a body, up to 5 tags and a `pinned` flag.

- Notes are kept **in memory**. Every time the server starts it loads the 3 notes in [`data/seed.json`](data/seed.json) (ids 1, 2 and 3), and anything you create is lost when it stops.
- Reads are open. Writes (`POST`, `PATCH`, `DELETE`) need a bearer token. See [Authentication](#authentication).
- Every error has the same JSON shape. See [Errors](#errors).
- The full API reference is in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1).

## Endpoints

| Method and path | Auth | What it does |
| --- | --- | --- |
| `GET /health` | no | Health check |
| `GET /notes` | no | List notes, with filters and pagination |
| `POST /notes` | bearer token | Create a note |
| `GET /notes/:id` | no | Get one note |
| `PATCH /notes/:id` | bearer token | Change some fields of a note |
| `DELETE /notes/:id` | bearer token | Delete a note |

Any other method or path returns `404` with the code `not_found` (for example `PUT /notes/1` returns `No route for PUT /notes/1`).

## Install, start and test

You need Node.js 20 or newer.

```sh
npm install        # install dependencies
npm start          # start the server on http://localhost:3000
npm test           # run the test suite (node --test)
npm run docs:check # check that README.md and openapi.yaml cover every route
```

When `NOTES_API_TOKEN` is not set, `npm start` prints this warning and then starts:

```text
NOTES_API_TOKEN is not set, so write requests use the token "dev-token".
notes-api listening on http://localhost:3000
```

### Environment variables

| Variable | Default | Used for |
| --- | --- | --- |
| `PORT` | `3000` | The port the server listens on. A value that is not a number (or `0`) falls back to `3000`. |
| `NOTES_API_TOKEN` | `dev-token` | The bearer token that write requests must send. Set it to your own secret anywhere other than your laptop. |

```sh
PORT=8080 NOTES_API_TOKEN=change-me npm start
```

## Authentication

`POST /notes`, `PATCH /notes/:id` and `DELETE /notes/:id` need this header:

```text
Authorization: Bearer <token>
```

`<token>` must equal `NOTES_API_TOKEN`, or `dev-token` when that variable is not set. The word `Bearer` is case-sensitive and must be followed by exactly one space. The `GET` routes do not check the header.

| Problem | Status | `error.message` |
| --- | --- | --- |
| No `Authorization` header, or it does not start with `Bearer ` | `401` | `Missing bearer token` |
| The token is wrong | `401` | `Invalid bearer token` |

The token is checked before anything else on a write route, so a request with a bad token gets `401` even if the note does not exist or the body is invalid.

## Notes

A note looks like this:

```json
{
  "id": 2,
  "title": "Groceries",
  "body": "Eggs, oat milk, coffee beans.",
  "tags": ["personal", "shopping"],
  "pinned": false,
  "createdAt": "2026-01-06T17:30:00.000Z",
  "updatedAt": "2026-01-07T08:15:00.000Z"
}
```

| Field | Type | Rules |
| --- | --- | --- |
| `id` | integer | Set by the server. Starts at 1 and goes up by one for each new note. Ids are not reused after a delete. |
| `title` | string | Required when you create a note. Leading and trailing spaces are removed, then it must be 1 to 120 characters. |
| `body` | string | Optional, up to 10000 characters. Defaults to `""`. |
| `tags` | array of strings | Optional, at most 5 items. Each tag must match `^[a-z0-9-]{1,20}$` (lowercase letters, digits and `-`). Duplicates are removed. Defaults to `[]`. |
| `pinned` | boolean | Optional. Defaults to `false`. |
| `createdAt`, `updatedAt` | string | ISO 8601 timestamps in UTC, set by the server. `updatedAt` changes on every `PATCH`. |

Request bodies must be JSON objects sent with `Content-Type: application/json`, and no larger than 100kb. Fields other than `title`, `body`, `tags` and `pinned` are rejected. A body sent without the JSON content type is ignored, so the request is treated as if it had no fields.

## Errors

Every error response has this shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request is not valid",
    "details": [{ "field": "title", "message": "is required" }]
  }
}
```

`details` is only present for `validation_error`. It lists every problem found, one item per field. `field` is the name of the body field or query parameter, or `(body)` when the problem is with the body as a whole.

| Status | `error.code` | When |
| --- | --- | --- |
| `400` | `validation_error` | A body field or query parameter is not valid |
| `400` | `invalid_json` | The body is not valid JSON, or is a JSON value that is not an object or array (for example `null`) |
| `401` | `unauthorized` | The bearer token is missing or wrong |
| `404` | `not_found` | The note does not exist, the id is not a positive whole number, or there is no such route |
| `413` | `payload_too_large` | The body is larger than 100kb |
| `500` | `internal_error` | An unexpected error. The message is always `Something went wrong` |

## Examples

These examples were run in this order against a fresh `npm start` with no environment variables set, so the token is `dev-token`. JSON responses are formatted here for reading; the server sends them on one line. The timestamps of new notes will be different when you run them.

### GET /health

```sh
curl -s http://localhost:3000/health
```

```json
{ "status": "ok" }
```

### GET /notes

Lists notes. Pinned notes come first, then the most recently updated, then the highest id.

| Query parameter | Default | Rules |
| --- | --- | --- |
| `limit` | `20` | Whole number from 1 to 100 |
| `offset` | `0` | Whole number from 0 to 1000000 |
| `tag` | none | Only notes that have this exact tag |
| `q` | none | Only notes whose title or body contains this text (case-insensitive) |
| `pinned` | none | `true` or `false` |

Filters can be combined, and a note must match all of them. An empty `tag` or `q` (for example `?tag=`) is ignored. `total` is the number of notes that match the filters before `limit` and `offset` are applied.

```sh
curl -s http://localhost:3000/notes
```

```json
{
  "data": [
    {
      "id": 1,
      "title": "Welcome to notes-api",
      "body": "This note is loaded from data/seed.json every time the server starts.",
      "tags": ["intro"],
      "pinned": true,
      "createdAt": "2026-01-05T09:00:00.000Z",
      "updatedAt": "2026-01-05T09:00:00.000Z"
    },
    {
      "id": 3,
      "title": "Sprint retro",
      "body": "Ship smaller PRs. Write the docs with the code.",
      "tags": ["work"],
      "pinned": false,
      "createdAt": "2026-01-08T15:00:00.000Z",
      "updatedAt": "2026-01-08T15:00:00.000Z"
    },
    {
      "id": 2,
      "title": "Groceries",
      "body": "Eggs, oat milk, coffee beans.",
      "tags": ["personal", "shopping"],
      "pinned": false,
      "createdAt": "2026-01-06T17:30:00.000Z",
      "updatedAt": "2026-01-07T08:15:00.000Z"
    }
  ],
  "total": 3,
  "limit": 20,
  "offset": 0
}
```

With a filter:

```sh
curl -s 'http://localhost:3000/notes?q=COFFEE&limit=1'
```

```json
{
  "data": [
    {
      "id": 2,
      "title": "Groceries",
      "body": "Eggs, oat milk, coffee beans.",
      "tags": ["personal", "shopping"],
      "pinned": false,
      "createdAt": "2026-01-06T17:30:00.000Z",
      "updatedAt": "2026-01-07T08:15:00.000Z"
    }
  ],
  "total": 1,
  "limit": 1,
  "offset": 0
}
```

### POST /notes

Creates a note. Needs the bearer token. The body needs `title`; `body`, `tags` and `pinned` are optional. Returns `201` with the new note and a `Location` header.

```sh
curl -s -i -X POST http://localhost:3000/notes \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"title":"  Call the dentist ","body":"Ask about the 3pm slot.","tags":["personal","todo","todo"]}'
```

```http
HTTP/1.1 201 Created
Location: /notes/4
Content-Type: application/json; charset=utf-8

{
  "id": 4,
  "title": "Call the dentist",
  "body": "Ask about the 3pm slot.",
  "tags": ["personal", "todo"],
  "pinned": false,
  "createdAt": "2026-11-02T03:22:17.621Z",
  "updatedAt": "2026-11-02T03:22:17.621Z"
}
```

The title was trimmed and the duplicate tag was removed. (`curl -i` also prints `Content-Length`, `ETag`, `Date`, `Connection` and `Keep-Alive` headers, left out here.)

### GET /notes/:id

```sh
curl -s http://localhost:3000/notes/4
```

```json
{
  "id": 4,
  "title": "Call the dentist",
  "body": "Ask about the 3pm slot.",
  "tags": ["personal", "todo"],
  "pinned": false,
  "createdAt": "2026-11-02T03:22:17.621Z",
  "updatedAt": "2026-11-02T03:22:17.621Z"
}
```

### PATCH /notes/:id

Changes only the fields you send. Needs the bearer token. The body must have at least one of `title`, `body`, `tags` or `pinned`, with the same rules as `POST /notes`. `tags` replaces the whole list. Returns `200` with the updated note. `updatedAt` is set to the current time.

```sh
curl -s -X PATCH http://localhost:3000/notes/4 \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"pinned":true,"tags":["personal"]}'
```

```json
{
  "id": 4,
  "title": "Call the dentist",
  "body": "Ask about the 3pm slot.",
  "tags": ["personal"],
  "pinned": true,
  "createdAt": "2026-11-02T03:22:17.621Z",
  "updatedAt": "2026-11-02T03:22:17.632Z"
}
```

If the note does not exist you get `404`, even if the body is also invalid.

### DELETE /notes/:id

Deletes a note. Needs the bearer token. Returns `204` with no body, or `404` if the note does not exist.

```sh
curl -s -i -X DELETE http://localhost:3000/notes/4 \
  -H 'Authorization: Bearer dev-token'
```

```http
HTTP/1.1 204 No Content
```

(`curl -i` also prints `Date`, `Connection` and `Keep-Alive` headers, left out here.)

### Error examples

The note is gone after the delete:

```sh
curl -s http://localhost:3000/notes/4
```

```json
{ "error": { "code": "not_found", "message": "Note 4 not found" } }
```

A write without a token:

```sh
curl -s -X POST http://localhost:3000/notes \
  -H 'Content-Type: application/json' \
  -d '{"title":"No token"}'
```

```json
{ "error": { "code": "unauthorized", "message": "Missing bearer token" } }
```

A body with several problems. Each one is listed in `details`:

```sh
curl -s -X POST http://localhost:3000/notes \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"title":"","tags":["Bad Tag"],"color":"red"}'
```

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request is not valid",
    "details": [
      { "field": "color", "message": "is not a known field" },
      { "field": "title", "message": "is required" },
      { "field": "tags", "message": "each tag must be 1-20 characters: a-z, 0-9 or -" }
    ]
  }
}
```

A query parameter out of range:

```sh
curl -s 'http://localhost:3000/notes?limit=500'
```

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request is not valid",
    "details": [{ "field": "limit", "message": "must be a whole number from 1 to 100" }]
  }
}
```

A body that is not valid JSON:

```sh
curl -s -X POST http://localhost:3000/notes \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"title":'
```

```json
{ "error": { "code": "invalid_json", "message": "Request body is not valid JSON" } }
```

## Project layout

| Path | What it is |
| --- | --- |
| `src/server.js` | Reads `PORT` and `NOTES_API_TOKEN` and starts the server |
| `src/app.js` | `createApp()`: the Express app and all routes |
| `src/store.js` | The in-memory note store, loaded from `data/seed.json` |
| `src/auth.js` | The bearer token check |
| `src/validate.js` | Validation for note bodies and query parameters |
| `src/errors.js` | `ApiError` and the JSON error handler |
| `test/notes.test.js` | Tests, run with `npm test` |
| `scripts/check-docs.js` | `npm run docs:check` |
| `openapi.yaml` | OpenAPI 3.1 reference for every route |

---

This repo is a starter for a Devin workshop lab. See [DEVIN_DEMO.md](DEVIN_DEMO.md) for the steps and the prompt.
