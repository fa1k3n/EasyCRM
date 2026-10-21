'use strict';
/* Assembles the app and the REST API for Cloudflare (Workers + D1 + Workers Static Assets on one domain).
 * Usage: node tools/cloudflare.js [--brand <folder with brand.json>] [--out-dir <folder>]
 *   Without --brand: profile/ in the repo root. Default --out-dir: <brand folder>/publish-cloudflare.
 * Needs npm run build first (server/dist/worker.mjs) and <brand folder>/cloudflare.json with the company's Cloudflare
 * names (no secrets; the brand folder is never in git):
 *   {"name": "<the Worker's name>", "databaseName": "<D1 name>", "databaseId": "<D1 id>", "accountId": "<optional>", "routes": [optional],
 *    "access": {"teamDomain": "<team>.cloudflareaccess.com", "aud": "<the Access application's AUD tag>"},
 *    "integrations": [optional: {"id": "<plugin in <brand folder>/integrations/<id>/>", "cron": "<schedule, UTC, e.g. 0 6 * * *>"}]}
 * Without access the Worker refuses every request from the internet (it only answers wrangler dev on localhost).
 * Writes <out-dir>/www (the app, like npm run serve), worker.mjs and wrangler.json (the brand as the variable BRAND).
 * With integrations each plugin is type-checked and built into worker.mjs with its settings.json, and its schedule
 * becomes a Cron Trigger; its secrets are set once with npx wrangler secret put <NAME> --config <out-dir>/wrangler.json.
 * Then: npx wrangler deploy --config <out-dir>/wrangler.json   (or wrangler dev to try it locally).
 * Exit code 0 = written, 1 = error (nothing is written). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {buildPreview} = require('./preview');
const {checkBrandJson} = require('./deploy');
const {buildWorker} = require('./build-server');
const {ID} = require('./integration-core');
const {loadPlugin} = require('./integration');

const ROOT = path.resolve(__dirname, '..');
const WORKER = path.join(ROOT, 'server', 'dist', 'worker.mjs');
/** The Workers runtime version the API is tested with (wrangler's compatibility_date) */
const COMPATIBILITY_DATE = '2026-10-01';

function parseArgs(argv) {
  const args = {brand: '', outDir: ''};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--brand' && argv[i + 1]) args.brand = path.resolve(argv[++i]);
    else if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  if (!args.brand) args.brand = path.join(ROOT, 'profile');
  if (!args.outDir) args.outDir = path.join(args.brand, 'publish-cloudflare');
  return args;
}

/* The company's Cloudflare names from cloudflare.json, checked */
function readSettings(brand) {
  const file = path.join(brand, 'cloudflare.json');
  if (!fs.existsSync(file)) {
    throw new Error(`Cannot find ${file}. Create the database once (in the EU): npx wrangler d1 create <name> --jurisdiction eu\n` +
      'and write {"name": "<Worker name>", "databaseName": "<name>", "databaseId": "<the id it printed>"} to that file.');
  }
  const s = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const errors = ['name', 'databaseName', 'databaseId'].filter(k => typeof s[k] !== 'string' || !s[k]).map(k => `cloudflare.json: "${k}" is missing`);
  if (s.name && !/^[a-z0-9-]{1,63}$/.test(s.name)) errors.push('cloudflare.json: "name" may only have a-z, 0-9 and -');
  if (s.routes !== undefined && !Array.isArray(s.routes)) errors.push('cloudflare.json: "routes" must be a list');
  if (s.access !== undefined) {
    for (const k of ['teamDomain', 'aud']) if (!s.access || typeof s.access[k] !== 'string' || !s.access[k]) errors.push(`cloudflare.json: "access.${k}" is missing`);
  }
  if (s.integrations !== undefined && !Array.isArray(s.integrations)) errors.push('cloudflare.json: "integrations" must be a list');
  const ids = new Set();
  (Array.isArray(s.integrations) ? s.integrations : []).forEach((i, n) => {
    if (!i || !ID.test(String(i.id))) errors.push(`cloudflare.json: integrations[${n}].id must be a plugin's folder name (a–z, 0–9, - and _)`);
    else if (ids.has(i.id)) errors.push(`cloudflare.json: the plugin ${i.id} is in integrations twice`);
    else ids.add(i.id);
    if (!i || !isCron(i.cron)) errors.push(`cloudflare.json: integrations[${n}].cron must be a schedule in UTC with five fields, e.g. "0 6 * * *"`);
  });
  if (errors.length) throw new Error(errors.join('\n'));
  return s;
}

// A cron schedule as Cloudflare takes it: five fields of digits, *, /, , and -
const isCron = c => typeof c === 'string' && c.trim().split(/\s+/).length === 5 && c.trim().split(/\s+/).every(f => /^[\d*/,-]+$/.test(f));

/* The Worker with the plugins built in: an entry that imports them and gives them to createWorker */
async function buildWithIntegrations(plugins, outDir) {
  const lines = plugins.map((p, n) => `import p${n} from ${JSON.stringify(p.entry)};`);
  const list = plugins.map((p, n) => `{manifest: p${n}, settings: ${JSON.stringify(p.settings)}, cron: ${JSON.stringify(p.cron)}}`);
  const entry = path.join(outDir, 'worker-entry.ts');
  fs.writeFileSync(entry, [`import {createWorker} from ${JSON.stringify(path.join(ROOT, 'server', 'src', 'worker.ts'))};`, ...lines,
    `export default createWorker({integrations: [${list.join(', ')}]});`, ''].join('\n'));
  await buildWorker(entry, outDir);
  fs.rmSync(entry);
}

async function assemble({brand, outDir}) {
  if (!fs.existsSync(path.join(brand, 'brand.json'))) throw new Error(`Cannot find brand.json in ${brand}`);
  const {text, errors} = checkBrandJson(path.join(brand, 'brand.json'));
  if (errors.length) throw new Error(`brand.json:\n  ${errors.join('\n  ')}`);
  const settings = readSettings(brand);
  if (!fs.existsSync(WORKER)) throw new Error('The API is not built: run npm run build first.');
  // Everything is built in a temporary folder first, so an error never leaves a half-written publish folder
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-cloudflare-'));
  try {
    buildPreview({outDir: path.join(tmp, 'www'), brand, api: true});
    const integrations = settings.integrations || [];
    // Each plugin is checked as npm run integration checks it (type check, build, manifest) before it is built in
    const plugins = [];
    for (const {id, cron} of integrations) {
      const {manifest, settings: own} = await loadPlugin(brand, id);
      plugins.push({id, cron, env: manifest.env || [], settings: own, entry: path.join(brand, 'integrations', id, 'index.ts')});
    }
    if (plugins.length) await buildWithIntegrations(plugins, tmp);
    else fs.copyFileSync(WORKER, path.join(tmp, 'worker.mjs'));
    const config = {
      name: settings.name,
      main: 'worker.mjs',
      compatibility_date: COMPATIBILITY_DATE,
      ...(settings.accountId ? {account_id: settings.accountId} : {}),
      ...(settings.routes ? {routes: settings.routes} : {}),
      ...(plugins.length ? {triggers: {crons: [...new Set(plugins.map(p => p.cron))]}} : {}),
      assets: {directory: 'www'},
      d1_databases: [{binding: 'DB', database_name: settings.databaseName, database_id: settings.databaseId}],
      vars: {
        BRAND: JSON.stringify(JSON.parse(text)),
        ...(settings.access ? {ACCESS_TEAM_DOMAIN: settings.access.teamDomain, ACCESS_AUD: settings.access.aud} : {})
      }
    };
    fs.writeFileSync(path.join(tmp, 'wrangler.json'), JSON.stringify(config, null, 2) + '\n', 'utf8');
    fs.rmSync(outDir, {recursive: true, force: true});
    fs.mkdirSync(path.dirname(outDir), {recursive: true});
    fs.cpSync(tmp, outDir, {recursive: true});
    return {outDir, access: !!settings.access, plugins};
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

async function main(argv) {
  try {
    const {outDir: out, access, plugins} = await assemble(parseArgs(argv));
    const config = path.join(out, 'wrangler.json');
    console.log(`  Cloudflare folder written: ${out}`);
    if (!access) console.log('  WARNING: no "access" in cloudflare.json: the Worker will refuse every request until Cloudflare Access is set up.');
    for (const p of plugins) {
      console.log(`  Integration plugin ${p.id}: runs on "${p.cron}" (UTC)`);
      // Only the names: the values are set by the user and never pass through here
      for (const name of p.env) console.log(`    its secret, once: npx wrangler secret put ${name} --config ${config}`);
    }
    console.log(`  Publish: npx wrangler deploy --config ${config}`);
    return 0;
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    return 1;
  }
}

module.exports = {assemble, COMPATIBILITY_DATE};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
