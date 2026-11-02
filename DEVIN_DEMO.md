# Devin demo: Write a README and API docs

**What it shows:** Devin reads a working notes API, writes a README with setup steps and examples, writes an OpenAPI file from the real routes, and runs every example against the running server before it opens a pull request.

**Needs:** GitHub only

More demos: [devin-advanced-demos](https://github.com/thequantexplorer/devin-advanced-demos)

## The problem

The API works and its tests pass, but the README is one line and there is no API reference. The repo has a docs check that compares the docs with the routes the app really serves. Today it fails:

```text
$ npm run docs:check
The app serves 6 routes:
  GET /health
  GET /notes
  POST /notes
  GET /notes/:id
  PATCH /notes/:id
  DELETE /notes/:id

Docs check failed (10 problems):
  - openapi.yaml is missing
  - README.md: no setup step mentions `npm install`
  - README.md: no setup step mentions `npm start`
  - README.md: no setup step mentions `npm test`
  - README.md: GET /health is not documented
  - README.md: GET /notes is not documented
  - README.md: POST /notes is not documented
  - README.md: GET /notes/:id is not documented
  - README.md: PATCH /notes/:id is not documented
  - README.md: DELETE /notes/:id is not documented
```

The **CI** workflow in `.github/workflows/ci.yml` runs `npm test` and `npm run docs:check`, so you can see the same result on the pull request.

## Set it up

1. Click **Use this template → Create a new repository**, choose your GitHub account or org as the owner, and keep the name `devin-demo-write-docs`. The prompt below assumes that name. Use the template rather than a fork: pull requests on a fork go to the original repo by default.
2. In Devin, open [**Settings → Connections → GitHub**](https://app.devin.ai/settings/connections/github) and make sure Devin can access the new repository.

## Prompt

Start a new session at [app.devin.ai](https://app.devin.ai) and paste this. Replace `<you>` with your GitHub user or org.

```text
Write the docs for https://github.com/<you>/devin-demo-write-docs. It is a small notes API that works, but its README is one line and it has no API reference.

1. Read the code first (src/, data/seed.json and test/). Run `npm test` and `npm run docs:check` and show me what the docs check reports.
2. Rewrite README.md for a developer who has never seen this repo: what the API does, how to install, start and test it, the environment variables it reads, how auth works, the error format, and one curl example for every endpoint with the real response. Keep the last line that links to DEVIN_DEMO.md.
3. Write openapi.yaml (OpenAPI 3.1) from the actual routes in src/app.js: every path, method, path and query parameter, request body, validation rule, status code and error response. Only document what the code really does.
4. Start the server and run every example request from the README against it, in order. If a response does not match the docs, fix the docs, not the code. Lint openapi.yaml with an OpenAPI linter such as `npx @redocly/cli lint openapi.yaml`.
5. Do not change anything in src/, test/ or data/. If something in the code looks like a bug, list it in the PR instead of fixing it.

When `npm test`, `npm run docs:check` and the lint all pass, open a PR. In the description, list the endpoints, show the commands you ran to check each example with their output, and list any open questions.
```

## What to look for

- It runs the docs check before it writes anything, and again at the end.
- The README examples are real: the PR shows each request and the response the server sent back.
- The OpenAPI file has the details you only find in the code, like the bearer token on write routes and the 120-character title limit.
