// Checks that README.md and openapi.yaml match the routes the app really serves.
const fs = require('node:fs');
const path = require('node:path');
const YAML = require('yaml');
const { createApp } = require('../src/app');

const root = path.join(__dirname, '..');
const METHODS = ['get', 'post', 'put', 'patch', 'delete'];
const problems = [];

function appRoutes() {
  const routes = [];
  for (const layer of createApp()._router.stack) {
    if (!layer.route) continue;
    for (const method of Object.keys(layer.route.methods)) {
      routes.push({ method: method.toUpperCase(), path: layer.route.path });
    }
  }
  return routes;
}

const toOpenApi = (p) => p.replace(/:(\w+)/g, '{$1}');
const routes = appRoutes();
const label = (r) => `${r.method} ${r.path}`;

console.log(`The app serves ${routes.length} routes:`);
for (const r of routes) console.log(`  ${label(r)}`);
console.log('');

// openapi.yaml
const specFile = path.join(root, 'openapi.yaml');
if (!fs.existsSync(specFile)) {
  problems.push('openapi.yaml is missing');
} else {
  let spec;
  try {
    spec = YAML.parse(fs.readFileSync(specFile, 'utf8'));
  } catch (err) {
    problems.push(`openapi.yaml is not valid YAML: ${err.message}`);
  }
  if (spec) {
    if (!/^3\./.test(String(spec.openapi))) problems.push('openapi.yaml: "openapi" must be a 3.x version');
    if (!spec.info || !spec.info.title || !spec.info.version) problems.push('openapi.yaml: info.title and info.version are required');
    const documented = new Set();
    for (const [p, item] of Object.entries(spec.paths || {})) {
      for (const m of Object.keys(item || {})) {
        if (!METHODS.includes(m)) continue;
        documented.add(`${m.toUpperCase()} ${p}`);
        const op = item[m] || {};
        if (!op.responses || Object.keys(op.responses).length === 0) {
          problems.push(`openapi.yaml: ${m.toUpperCase()} ${p} has no responses`);
        }
        const params = [...(item.parameters || []), ...(op.parameters || [])];
        for (const [, name] of p.matchAll(/\{(\w+)\}/g)) {
          if (!params.some((x) => x && x.in === 'path' && x.name === name)) {
            problems.push(`openapi.yaml: ${m.toUpperCase()} ${p} does not declare path parameter "${name}"`);
          }
        }
      }
    }
    for (const r of routes) {
      const key = `${r.method} ${toOpenApi(r.path)}`;
      if (!documented.has(key)) problems.push(`openapi.yaml: ${key} is not documented`);
      documented.delete(key);
    }
    for (const extra of documented) problems.push(`openapi.yaml: ${extra} is documented but the app does not serve it`);
  }
}

// README.md
const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8');
for (const cmd of ['npm install', 'npm start', 'npm test']) {
  if (!readme.includes(cmd)) problems.push(`README.md: no setup step mentions \`${cmd}\``);
}
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const mentions = (text) => new RegExp(`${escape(text)}(?![\\w/:{])`).test(readme);
for (const r of routes) {
  if (!mentions(label(r)) && !mentions(`${r.method} ${toOpenApi(r.path)}`)) {
    problems.push(`README.md: ${label(r)} is not documented`);
  }
}

if (problems.length) {
  console.error(`Docs check failed (${problems.length} problems):`);
  for (const p of problems) console.error(`  - ${p}`);
  process.exit(1);
}
console.log('Docs check passed: README.md and openapi.yaml cover every route.');
