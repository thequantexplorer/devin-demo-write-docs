# notes-api

A small REST API for notes, built with [Express](https://expressjs.com/). You can list, search, read, create, update and delete notes. Each note has a title, a body, up to five tags and a pinned flag.

Notes are kept **in memory**. Every time the server starts it loads the three notes in [`data/seed.json`](data/seed.json) (ids 1, 2 and 3), and any changes you make are lost when it stops.

The full API reference is in [`openapi.yaml`](openapi.yaml) (OpenAPI 3.1).

## Requirements

- Node.js 20 or newer
- npm

## Install, start and test

```bash
npm install     # install dependencies
npm start       # start the server on http://localhost:3000
npm test        # run the test suite (node --test)
npm run docs:check   # check that README.md and openapi.yaml cover every route
```

When `NOTES_API_TOKEN` is not set, `npm start` prints:

```text
NOTES_API_TOKEN is not set, so write requests use the token "dev-token".
notes-api listening on http://localhost:3000
```

The tests start their own server on a random port, so you do not need `npm start` to run them.

## Environment variables

| Variable          | Default     | What it does |
| ----------------- | ----------- | ------------ |
| `PORT`            | `3000`      | Port the server listens on. If it is unset, `0` or not a number, the server uses `3000`. |
| `NOTES_API_TOKEN` | `dev-token` | The bearer token that write requests must send. If it is unset or empty, the token is `dev-token` and the server prints a warning at startup. |

Example:

```bash
PORT=8080 NOTES_API_TOKEN=s3cret npm start
```

## Authentication

Read requests (`GET`) are public. Write requests (`POST`, `PATCH` and `DELETE`) need the API token in an `Authorization` header:

```text
Authorization: Bearer dev-token
```

- The scheme must be exactly `Bearer` (capital B), followed by one space and the token.
- If the header is missing or does not start with `Bearer `, the API returns `401` with the message `Missing bearer token`.
- If the token does not match `NOTES_API_TOKEN`, the API returns `401` with the message `Invalid bearer token`.
- The token is checked before anything else, so a write request without a valid token gets `401` even if the note does not exist or the body is invalid.

## The note object

| Field       | Type             | Notes |
| ----------- | ---------------- | ----- |
| `id`        | integer          | Set by the server. New notes get the next id (4, 5, ...). Ids are never reused while the server runs. |
| `title`     | string           | Required when creating. Leading and trailing spaces are trimmed. 1-120 characters after trimming. |
| `body`      | string           | Optional, defaults to `""`. At most 10000 characters. |
| `tags`      | array of strings | Optional, defaults to `[]`. At most 5 items. Each tag is 1-20 characters of `a-z`, `0-9` or `-`. Duplicates are removed. |
| `pinned`    | boolean          | Optional, defaults to `false`. |
| `createdAt` | string           | ISO 8601 UTC timestamp, set by the server. |
| `updatedAt` | string           | ISO 8601 UTC timestamp, updated on every `PATCH`. |

Any other field in a request body is rejected with `400 validation_error`.

## Errors

Every error has the same JSON shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request is not valid",
    "details": [
      { "field": "title", "message": "is required" }
    ]
  }
}
```

`details` is only present for `validation_error`. Each item names the field (or `(body)` for the body as a whole, or the query parameter name) and what is wrong with it. All problems in a request body are reported at once.

| Status | `code`              | When |
| ------ | ------------------- | ---- |
| 400    | `validation_error`  | A query parameter or request body field is not valid. |
| 400    | `invalid_json`      | The body is sent as `application/json` but is not valid JSON, or is not an object or array (for example `"hi"`). |
| 401    | `unauthorized`      | A write request has a missing or wrong bearer token. |
| 404    | `not_found`         | The note does not exist, the id is not a positive integer, or no route matches the method and path (`No route for PUT /notes/1`). |
| 413    | `payload_too_large` | The request body is larger than 100kb. |
| 500    | `internal_error`    | Any other error. The message is always `Something went wrong`. |

There is no `405 Method Not Allowed`: a method the API does not serve on a path returns `404 not_found`.

## Endpoints

| Method   | Path          | Auth   | Description |
| -------- | ------------- | ------ | ----------- |
| `GET`    | `/health`     | none   | Health check |
| `GET`    | `/notes`      | none   | List and search notes |
| `POST`   | `/notes`      | bearer | Create a note |
| `GET`    | `/notes/:id`  | none   | Get one note |
| `PATCH`  | `/notes/:id`  | bearer | Update some fields of a note |
| `DELETE` | `/notes/:id`  | bearer | Delete a note |

The examples below were run in this order against a freshly started server (`npm start`, no environment variables), so they use the seed notes and the default token. The server sends compact JSON; the responses here are pretty-printed. Timestamps on notes you create will be different.

### GET /health

Returns `200` when the server is running.

```bash
curl -s http://localhost:3000/health
```

```json
{
  "status": "ok"
}
```

### GET /notes

Lists notes. Pinned notes come first, then the most recently updated, then the highest id.

| Query parameter | Default | Rules |
| --------------- | ------- | ----- |
| `limit`  | `20` | Whole number from 1 to 100. |
| `offset` | `0`  | Whole number from 0 to 1000000. |
| `tag`    | none | Only notes that have exactly this tag. |
| `q`      | none | Only notes whose title or body contains this text (case-insensitive). |
| `pinned` | none | `true` or `false`. |

`total` is the number of notes that match the filters before `limit` and `offset` are applied. An invalid `limit`, `offset` or `pinned` returns `400 validation_error`; only the first invalid one is reported.

```bash
curl -s 'http://localhost:3000/notes?limit=2'
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
    }
  ],
  "total": 3,
  "limit": 2,
  "offset": 0
}
```

Filters can be combined:

```bash
curl -s 'http://localhost:3000/notes?tag=shopping&q=coffee'
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
  "limit": 20,
  "offset": 0
}
```

### GET /notes/:id

Returns one note, or `404 not_found` if there is no note with that id.

```bash
curl -s http://localhost:3000/notes/2
```

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

### POST /notes

Creates a note. Needs a bearer token. `title` is required; `body`, `tags` and `pinned` are optional. Returns `201` with the new note and a `Location` header.

The title below is trimmed and the duplicate tag is removed:

```bash
curl -s -i -X POST http://localhost:3000/notes \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"title": "  Call the dentist ", "tags": ["personal", "personal"]}'
```

```http
HTTP/1.1 201 Created
Location: /notes/4
Content-Type: application/json; charset=utf-8

{
  "id": 4,
  "title": "Call the dentist",
  "body": "",
  "tags": ["personal"],
  "pinned": false,
  "createdAt": "2026-11-02T03:21:41.854Z",
  "updatedAt": "2026-11-02T03:21:41.854Z"
}
```

### PATCH /notes/:id

Updates only the fields you send and sets `updatedAt`. Needs a bearer token. The body must have at least one field. Returns `200` with the updated note, or `404 not_found` if the note does not exist.

```bash
curl -s -X PATCH http://localhost:3000/notes/4 \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"pinned": true}'
```

```json
{
  "id": 4,
  "title": "Call the dentist",
  "body": "",
  "tags": ["personal"],
  "pinned": true,
  "createdAt": "2026-11-02T03:21:41.854Z",
  "updatedAt": "2026-11-02T03:21:41.860Z"
}
```

### DELETE /notes/:id

Deletes a note. Needs a bearer token. Returns `204` with no body, or `404 not_found` if the note does not exist.

```bash
curl -s -i -X DELETE http://localhost:3000/notes/4 \
  -H 'Authorization: Bearer dev-token'
```

```http
HTTP/1.1 204 No Content
```

### Error examples

A write request without a token:

```bash
curl -s -X POST http://localhost:3000/notes \
  -H 'Content-Type: application/json' \
  -d '{"title": "No token"}'
```

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing bearer token"
  }
}
```

A body with several problems:

```bash
curl -s -X POST http://localhost:3000/notes \
  -H 'Authorization: Bearer dev-token' \
  -H 'Content-Type: application/json' \
  -d '{"title": "", "tags": ["Bad Tag"], "color": "red"}'
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

The note deleted above:

```bash
curl -s http://localhost:3000/notes/4
```

```json
{
  "error": {
    "code": "not_found",
    "message": "Note 4 not found"
  }
}
```

---

This repo is a starter for a Devin workshop lab. See [DEVIN_DEMO.md](DEVIN_DEMO.md) for the steps and the prompt.
