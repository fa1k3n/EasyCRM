'use strict';
/* Runs an integration plugin (tools/integration-api.ts): data from another service, e.g. invoices, into the register.
 * Usage: node tools/integration.js <id> --url <server> [--brand <folder>] [--since <YYYY-MM-DD>] [--env-file <file>] [--apply]
 *   (npm run integration -- <id> ...). The plugin is <brand folder>/integrations/<id>/index.ts (default brand folder:
 *   profile/). <server> is the REST API, e.g. http://127.0.0.1:8787 or the cloud address.
 * The plugin is type-checked against the contract, gets only its declared environment variables and hosts, reads the
 * customers frozen and returns a plan. Without --apply nothing is written: the plan is shown. With --apply the platform
 * writes it through the REST API (new jobs with POST, existing ones only in the fields the plugin owns, always with If-Match).
 * Secrets come from the environment; ~/.config/crm/access.env (the Access service token) and ~/.config/crm/<id>.env are
 * read when they exist. Nothing secret is ever printed.
 * Exit code 0 = done, 1 = error, 2 = a missing environment variable or setting. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');
const vm = require('vm');
const {accessHeaders, request} = require('./data');

const ROOT = path.resolve(__dirname, '..');
const API = path.join(ROOT, 'tools', 'integration-api.ts');
const GLOBALS = path.join(ROOT, 'tools', 'integration-globals.d.ts');
const API_VERSION = 1;
// The job fields a plugin may own. The type OwnedJobField (tools/integration-api.ts) is wider on purpose, so that a
// plugin naming another field gets this check's message about owns; keep its comment in step. Never the user's
// title, amount or link
const OWNED_JOB_FIELDS = ['invoiceNumber', 'invoiceStatus', 'dueDate'];
const ID = /^[a-z0-9_-]+$/;
const L = () => require(path.join(ROOT, 'crm', 'logic.js'));

/* ---------- Loading ---------- */

// Type check of the plugin against the contract (tools/build.js on a temporary tsconfig), like the app's extensions
function typeCheck(entry) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-check-'));
  try {
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        // No DOM: fetch, process and the rest are type errors; tools/integration-globals.d.ts has what a plugin may use
        target: 'ES2022', lib: ['ES2022'], module: 'ESNext', moduleResolution: 'bundler', strict: true, noEmit: true,
        skipLibCheck: true, isolatedModules: true, types: [], paths: {'crm-integration-api': [API]}
      },
      files: [entry, path.join(ROOT, 'crm', 'logic', 'types.ts'), GLOBALS]
    }));
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--project', dir], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(`The plugin has type errors:\n${r.stdout}${r.stderr}`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

// Builds the plugin with Vite into one CommonJS file (in its own Node process, so that Vite's ES modules load the same
// way everywhere) and loads it
const BUILD = `
  const [entry, outDir, api] = process.argv.slice(1);
  const {build} = await import('vite');
  await build({
    configFile: false, logLevel: 'silent', mode: 'production',
    resolve: {alias: {'crm-integration-api': api}},
    ssr: {noExternal: true, target: 'node'},
    build: {outDir, emptyOutDir: true, ssr: entry, target: 'node24',
      rolldownOptions: {output: {format: 'cjs', entryFileNames: 'plugin.cjs', codeSplitting: false}}}
  });`;

function bundle(entry) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-integration-build-'));
  try {
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', BUILD, entry, dir, API], {encoding: 'utf8', cwd: ROOT});
    if (r.status !== 0) throw new Error(`The plugin could not be built:\n${r.stdout}${r.stderr}`);
    return runIsolated(fs.readFileSync(path.join(dir, 'plugin.cjs'), 'utf8'));
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

/* Runs the built plugin in its own context with only JavaScript's built-ins and the globals in
 * integration-globals.d.ts: no fetch, process or require, so ctx is the only way out. Not a hard security boundary
 * (the plugins are the company's own code), but nothing reaches around ctx by accident. */
function runIsolated(code) {
  const context = vm.createContext({URL, URLSearchParams, structuredClone});
  const wrapper = vm.runInContext(`(function (module, exports) {\n${code}\n})`, context, {filename: 'plugin.cjs'});
  const mod = {exports: {}};
  wrapper(mod, mod.exports);
  const manifest = mod.exports && mod.exports.default ? mod.exports.default : mod.exports;
  if (!manifest || typeof manifest !== 'object') return manifest;
  // The plan comes back as plain JSON in this program's own objects: anything that is not JSON is dropped here
  const run = manifest.run;
  return {...manifest, ...(typeof run === 'function' ? {run: async ctx => JSON.parse(JSON.stringify((await run.call(manifest, ctx)) ?? null))} : {})};
}

function checkManifest(m, id) {
  const errors = [];
  if (!m || typeof m !== 'object') return ['the default export must be the manifest'];
  if (m.id !== id || !ID.test(String(m.id))) errors.push(`id must be "${id}" (the folder's name, a–z, 0–9, - and _)`);
  if (m.apiVersion !== API_VERSION) errors.push(`apiVersion ${m.apiVersion} is not supported (this platform has ${API_VERSION})`);
  if (typeof m.name !== 'string' || !m.name) errors.push('name is missing');
  if (typeof m.run !== 'function') errors.push('run must be a function');
  for (const k of ['env', 'hosts']) if (m[k] !== undefined && !(Array.isArray(m[k]) && m[k].every(x => typeof x === 'string' && x))) errors.push(`${k} must be a list of texts`);
  const owned = m.owns && m.owns.jobs;
  if (owned !== undefined && !(Array.isArray(owned) && owned.every(f => OWNED_JOB_FIELDS.includes(f)))) {
    errors.push(`owns.jobs may only have: ${OWNED_JOB_FIELDS.join(', ')}`);
  }
  return errors;
}

/** Loads <brand>/integrations/<id>/index.ts: type check, build, manifest check, and its settings.json */
async function loadPlugin(brand, id) {
  const dir = path.join(brand, 'integrations', id);
  const entry = path.join(dir, 'index.ts');
  if (!fs.existsSync(entry)) throw new Error(`Cannot find the plugin: ${entry}`);
  typeCheck(entry);
  const manifest = bundle(entry);
  const errors = checkManifest(manifest, id);
  if (errors.length) throw new Error(`The plugin ${id} cannot be used:\n  ${errors.join('\n  ')}`);
  const file = path.join(dir, 'settings.json');
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : {};
  return {manifest, settings};
}

/* ---------- What the plugin gets ---------- */

function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const today = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };

/** The plugin's ctx: only its variables, a GET-only fetch to its hosts over https, frozen copies of the customers */
function makeContext({manifest, settings = {}, env = process.env, customers, fetchImpl = fetch, options = {}}) {
  const names = manifest.env || [];
  const missing = names.filter(n => !env[n]);
  if (missing.length) throw Object.assign(new Error(`Missing environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`), {exitCode: 2});
  // Reading a variable the manifest did not declare (a name like MY_KEY) throws, so a missing env entry is found at once
  const declared = Object.freeze(Object.fromEntries(names.map(n => [n, env[n]])));
  const config = new Proxy(declared, {
    get(target, key) {
      if (typeof key === 'string' && /^[A-Z][A-Z0-9_]*$/.test(key) && !Object.prototype.hasOwnProperty.call(target, key)) {
        throw new Error(`${key} is not among the plugin's env (declare it in the manifest)`);
      }
      return target[key];
    }
  });
  const hosts = manifest.hosts || [];
  return {
    config,
    async fetch(url, init = {}) {
      const u = new URL(url);
      if (u.protocol !== 'https:') throw new Error(`Only https is allowed: ${u.protocol}//${u.host}`);
      if (!hosts.includes(u.hostname)) throw new Error(`${u.hostname} is not among the plugin's hosts (${hosts.join(', ') || 'none'})`);
      if (init.method && init.method.toUpperCase() !== 'GET') throw new Error('Only GET is allowed: a plugin only reads the service');
      // A redirect is never followed: it could lead to a host outside hosts
      const res = await fetchImpl(u.href, {method: 'GET', redirect: 'error', headers: {...(init.headers || {})}});
      return {ok: res.ok, status: res.status, json: () => res.json(), text: () => res.text()};
    },
    customers: deepFreeze(structuredClone(customers)),
    today: today(),
    options: Object.freeze({...options}),
    settings: deepFreeze(structuredClone(settings))
  };
}

/* ---------- The plan ---------- */

/** Problems that stop the plan from being written (empty = fine) */
function checkPlan(plan, manifest, customers) {
  if (!plan || typeof plan !== 'object') return ['run must return a plan object'];
  const issues = [], ids = new Set(customers.map(c => c.id)), seen = new Set();
  for (const k of ['customers', 'jobs', 'links', 'unmatched', 'notes']) if (plan[k] !== undefined && !Array.isArray(plan[k])) issues.push(`${k} must be a list`);
  // New customers (create only); jobs and links in the same plan may refer to them
  for (const n of Array.isArray(plan.customers) ? plan.customers : []) {
    if (!n || typeof n.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(n.id)) { issues.push('a new customer has no valid id'); continue; }
    if (ids.has(n.id)) { issues.push(`${seen.has('customer/' + n.id) ? `new customer ${n.id} is in the plan twice` : `customer ${n.id} already exists`}`); continue; }
    if (!n.data || typeof n.data !== 'object' || Array.isArray(n.data)) { issues.push(`new customer ${n.id}: data must be an object`); continue; }
    for (const i of L().validateCustomer(n.data)) issues.push(`new customer ${n.id}: ${i.path} ${i.message}`);
    // Only the plugin's own field in ext, as for links
    const ext = n.data.ext && typeof n.data.ext === 'object' ? Object.keys(n.data.ext) : [];
    for (const k of ext.filter(k => k !== manifest.id)) issues.push(`new customer ${n.id}: ext.${k} belongs to someone else (only ext.${manifest.id})`);
    ids.add(n.id);
    seen.add('customer/' + n.id);
  }
  const list = k => (Array.isArray(plan[k]) ? plan[k] : []);
  for (const j of list('jobs')) {
    const item = j && j.item;
    if (!j || !ids.has(j.customerId)) { issues.push(`job for an unknown customer: ${j && j.customerId}`); continue; }
    if (!item || typeof item.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/.test(item.id)) { issues.push(`a job for ${j.customerId} has no valid id`); continue; }
    const key = `${j.customerId}/${item.id}`;
    if (seen.has(key)) issues.push(`job ${item.id} is in the plan twice`);
    seen.add(key);
    for (const i of L().validateCustomer({jobs: [item]})) issues.push(`job ${item.id}: ${i.path.replace('jobs[0].', '')} ${i.message}`);
  }
  for (const l of list('links')) {
    if (!l || !ids.has(l.customerId)) issues.push(`link for an unknown customer: ${l && l.customerId}`);
    else { try { JSON.stringify(l.data); } catch { issues.push(`the link for ${l.customerId} is not JSON`); } }
  }
  for (const k of ['unmatched', 'notes']) if (list(k).some(x => typeof x !== 'string')) issues.push(`${k} must be texts`);
  return issues;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** What writing the plan would change: new jobs, changed owned fields on existing jobs, and changed links */
function diffPlan(plan, manifest, customers) {
  const byId = new Map(customers.map(c => [c.id, c]));
  const owned = (manifest.owns && manifest.owns.jobs) || [];
  const out = {create: [], update: [], links: []};
  // New customers: only when the plan has them (then they are written first); their jobs and links start from them
  if (Array.isArray(plan.customers)) {
    out.customers = plan.customers.filter(n => !byId.has(n.id));
    for (const n of out.customers) byId.set(n.id, {id: n.id, ...n.data});
  }
  for (const {customerId, item} of plan.jobs || []) {
    const old = (byId.get(customerId).jobs || []).find(x => x && x.id === item.id);
    if (!old) { out.create.push({customerId, item}); continue; }
    const patch = Object.fromEntries(owned.filter(f => item[f] !== undefined && !same(item[f], old[f])).map(f => [f, item[f]]));
    if (Object.keys(patch).length) out.update.push({customerId, itemId: item.id, patch});
  }
  for (const {customerId, data} of plan.links || []) {
    const ext = byId.get(customerId).ext || {};
    if (!same(ext[manifest.id], data)) out.links.push({customerId, data});
  }
  return out;
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The plan as text for the user: what is new and what changes, per customer */
function formatPlan(diff, plan, customers) {
  const all = [...customers, ...(diff.customers || []).map(n => ({id: n.id, ...n.data}))];
  // The company, or the id: never a contact person's name (design rule 9)
  const name = id => { const c = all.find(x => x.id === id); return (c && c.company) || id; };
  const lines = [`  ${diff.customers ? `${plural(diff.customers.length, 'new customer')}, ` : ''}${plural(diff.create.length, 'new job')}, ${plural(diff.update.length, 'changed job')}, ${plural(diff.links.length, 'customer link')} to save`];
  // The name only: the plan is for the user to check, and e-mail addresses are not printed (design rule 9)
  for (const n of diff.customers || []) lines.push(`    + new customer: ${name(n.id)}`);
  for (const {customerId, item} of diff.create) lines.push(`    + ${name(customerId)}: ${item.title || item.id}${item.invoiceNumber !== undefined ? ` (invoice ${item.invoiceNumber})` : ''}${item.amount ? `, ${item.amount}` : ''}`);
  for (const {customerId, itemId, patch} of diff.update) lines.push(`    ~ ${name(customerId)}: ${itemId}: ${Object.entries(patch).map(([k, v]) => `${k} → ${v}`).join(', ')}`);
  for (const {customerId} of diff.links) lines.push(`    ↔ ${name(customerId)}: linked`);
  if ((plan.unmatched || []).length) lines.push(`  Not connected to a customer (${plan.unmatched.length}): ${plan.unmatched.join(', ')}`);
  for (const n of plan.notes || []) lines.push(`  Note: ${n}`);
  return lines.join('\n');
}

/* ---------- The command ---------- */

function parseArgs(argv) {
  const args = {id: '', brand: path.join(ROOT, 'profile'), url: '', since: '', apply: false, envFiles: []};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) args.url = argv[++i].replace(/\/+$/, '');
    else if (argv[i] === '--brand' && argv[i + 1]) args.brand = path.resolve(argv[++i]);
    else if (argv[i] === '--since' && argv[i + 1]) args.since = argv[++i];
    else if (argv[i] === '--env-file' && argv[i + 1]) args.envFiles.push(path.resolve(argv[++i]));
    else if (argv[i] === '--apply') args.apply = true;
    else if (!argv[i].startsWith('--') && !args.id) args.id = argv[i];
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  if (!ID.test(args.id)) throw new Error('Usage: node tools/integration.js <id> --url <server> [--brand <folder>] [--since <date>] [--env-file <file>] [--apply]');
  if (!args.url) throw new Error('--url is missing: the REST API, e.g. http://127.0.0.1:8787');
  if (args.since && !/^\d{4}-\d{2}-\d{2}$/.test(args.since)) throw new Error('--since must be a date YYYY-MM-DD');
  return args;
}

// KEY=VALUE lines into env, without overwriting what is already set; the values are never printed. A file others can
// read gives a warning
function readEnvFile(file, env) {
  if (process.platform !== 'win32' && (fs.statSync(file).mode & 0o077)) console.error(`  WARNING: ${file} can be read by others: chmod 600 ${file}`);
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith('#') && env[m[1]] === undefined) env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

// The secret values (at least 4 characters), so that they can be kept out of what is shown
let secrets = [];
const mask = text => secrets.reduce((t, s) => t.split(s).join('***'), String(text));

async function main(argv) {
  try {
    const args = parseArgs(argv);
    const env = {...process.env};
    const home = path.join(os.homedir(), '.config', 'crm');
    for (const f of [...args.envFiles, path.join(home, 'access.env'), path.join(home, `${args.id}.env`)]) if (fs.existsSync(f)) readEnvFile(f, env);
    // tools/data.js reads the Access token from process.env
    for (const k of ['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET']) if (env[k]) process.env[k] = env[k];
    const {manifest, settings} = await loadPlugin(args.brand, args.id);
    const customers = await request(`${args.url}/api/v1/customers`);
    secrets = [...(manifest.env || []), 'CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET'].map(n => env[n]).filter(v => v && v.length >= 4);
    const ctx = makeContext({manifest, settings, env, customers, options: args.since ? {since: args.since} : {}});
    const plan = await manifest.run(ctx);
    if (secrets.some(s => JSON.stringify(plan).includes(s))) throw new Error('The plan holds one of the secret values (a key); nothing is shown or written. Fix the plugin.');
    const issues = checkPlan(plan, manifest, customers);
    if (issues.length) throw new Error(`The plugin's plan cannot be written:\n  ${issues.join('\n  ')}`);
    const diff = diffPlan(plan, manifest, customers);
    console.log(`  ${manifest.name} (${manifest.id}):`);
    console.log(formatPlan(diff, plan, customers));
    if (!args.apply) {
      console.log('  Dry run: nothing is written. Add --apply to write.');
      return 0;
    }
    const n = await applyPlan(diff, manifest, args.url);
    console.log(`  Written: ${n.customers !== undefined ? `${plural(n.customers, 'new customer')}, ` : ''}${plural(n.created, 'new job')}, ${plural(n.updated, 'changed job')}, ${plural(n.linked, 'customer link')}.`);
    return 0;
  } catch (e) {
    console.error(`[ERROR] ${mask(e.message)}`);
    return e.exitCode || 1;
  }
}

/* ---------- Writing ---------- */

// One call to the REST API (with the Access token when there is one): status, body and the version from ETag
async function call(url, method, body, version) {
  const headers = {...accessHeaders()};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const res = await fetch(url, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
  const tag = /^"(\d+)"$/.exec(res.headers.get('ETag') || '');
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok && res.status !== 412) {
    const e = data && data.error;
    throw new Error(`The server answered ${res.status} for ${method} ${new URL(url).pathname}: ${e ? e.message : 'no message'}`);
  }
  return {status: res.status, data, version: tag ? Number(tag[1]) : undefined};
}

/* Writes one change with the customer's current version. If someone else wrote in between (412), the customer is read
 * again and the change is made on the new version; a job that is already there is not added again. */
async function writeWithVersion(base, customerId, write) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await call(`${base}/customers/${encodeURIComponent(customerId)}`, 'GET');
    const r = await write(current.data, current.version);
    if (!r || r.status !== 412) return r;
  }
  throw new Error(`The customer ${customerId} kept changing; run the integration again`);
}

/** Writes the diff through the REST API: new jobs with POST (the server's rules run), owned fields on existing jobs
 * with PATCH, and the plugin's link in customer.ext[<id>]. Always with If-Match. Returns how many of each were written */
async function applyPlan(diff, manifest, serverUrl) {
  const base = `${serverUrl.replace(/\/+$/, '')}/api/v1`;
  const n = {...(diff.customers ? {customers: 0} : {}), created: 0, updated: 0, linked: 0};
  // New customers first, create only (If-Match "0"): an existing one is never overwritten
  for (const c of diff.customers || []) {
    const r = await call(`${base}/customers/${encodeURIComponent(c.id)}`, 'PUT', c.data, 0);
    if (r.status !== 412) n.customers++;
  }
  const has = (customer, id) => (customer.jobs || []).some(j => j && j.id === id);
  for (const {customerId, item} of diff.create) {
    await writeWithVersion(base, customerId, async (customer, version) => {
      if (has(customer, item.id)) return null;
      const r = await call(`${base}/customers/${encodeURIComponent(customerId)}/jobs`, 'POST', item, version);
      if (r.status !== 412) n.created++;
      return r;
    });
  }
  for (const {customerId, itemId, patch} of diff.update) {
    await writeWithVersion(base, customerId, async (customer, version) => {
      if (!has(customer, itemId)) return null;
      const r = await call(`${base}/customers/${encodeURIComponent(customerId)}/jobs/${encodeURIComponent(itemId)}`, 'PATCH', patch, version);
      if (r.status !== 412) n.updated++;
      return r;
    });
  }
  for (const {customerId, data} of diff.links) {
    await writeWithVersion(base, customerId, async (customer, version) => {
      const r = await call(`${base}/customers/${encodeURIComponent(customerId)}`, 'PATCH', {ext: {...(customer.ext || {}), [manifest.id]: data}}, version);
      if (r.status !== 412) n.linked++;
      return r;
    });
  }
  return n;
}

module.exports = {loadPlugin, makeContext, checkPlan, diffPlan, formatPlan, applyPlan};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
