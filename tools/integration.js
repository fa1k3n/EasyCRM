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
const core = require('./integration-core');

const ROOT = path.resolve(__dirname, '..');
const API = path.join(ROOT, 'tools', 'integration-api.ts');
const GLOBALS = path.join(ROOT, 'tools', 'integration-globals.d.ts');
const {ID} = core;
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

/** Loads <brand>/integrations/<id>/index.ts: type check, build, manifest check, and its settings.json */
async function loadPlugin(brand, id) {
  const dir = path.join(brand, 'integrations', id);
  const entry = path.join(dir, 'index.ts');
  if (!fs.existsSync(entry)) throw new Error(`Cannot find the plugin: ${entry}`);
  typeCheck(entry);
  const manifest = bundle(entry);
  const errors = core.checkManifest(manifest, id);
  if (errors.length) throw new Error(`The plugin ${id} cannot be used:\n  ${errors.join('\n  ')}`);
  const file = path.join(dir, 'settings.json');
  const settings = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, '')) : {};
  return {manifest, settings};
}

/* ---------- What the plugin gets and its plan (tools/integration-core.js) ---------- */

/** The plugin's ctx (core.makeContext), here with the process's environment and Node's fetch by default */
const makeContext = ({env = process.env, fetchImpl = fetch, ...rest}) => core.makeContext({env, fetchImpl, ...rest});
/** Problems that stop the plan from being written (empty = fine) */
const checkPlan = (plan, manifest, customers) => core.checkPlan(plan, manifest, customers, L().validateCustomer);
const {diffPlan} = core;

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

// The REST API over HTTP (with the Access token when there is one), as core.applyPlan calls it
const httpCall = base => async (method, apiPath, body, version) => {
  const headers = {...accessHeaders()};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (version !== undefined) headers['If-Match'] = `"${version}"`;
  const res = await fetch(`${base}${apiPath}`, {method, headers, body: body === undefined ? undefined : JSON.stringify(body)});
  const tag = /^"(\d+)"$/.exec(res.headers.get('ETag') || '');
  return {status: res.status, data: res.status === 204 ? null : await res.json().catch(() => null), version: tag ? Number(tag[1]) : undefined};
};

/** Writes the diff through the REST API at serverUrl (core.applyPlan, without a limit). Returns how many of each were written */
async function applyPlan(diff, manifest, serverUrl) {
  const {remaining, ...n} = await core.applyPlan(diff, manifest, httpCall(`${serverUrl.replace(/\/+$/, '')}/api/v1`));
  return n;
}

module.exports = {loadPlugin, makeContext, checkPlan, diffPlan, formatPlan, applyPlan};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
