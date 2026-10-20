'use strict';
/* Assembles the app and the REST API for Cloudflare (Workers + D1 + Workers Static Assets on one domain).
 * Usage: node tools/cloudflare.js [--brand <folder with brand.json>] [--out-dir <folder>]
 *   Without --brand: profile/ in the repo root. Default --out-dir: <brand folder>/publish-cloudflare.
 * Needs npm run build first (server/dist/worker.mjs) and <brand folder>/cloudflare.json with the company's Cloudflare
 * names (no secrets; the brand folder is never in git):
 *   {"name": "<the Worker's name>", "databaseName": "<D1 name>", "databaseId": "<D1 id>", "accountId": "<optional>", "routes": [optional],
 *    "access": {"teamDomain": "<team>.cloudflareaccess.com", "aud": "<the Access application's AUD tag>"}}
 * Without access the Worker refuses every request from the internet (it only answers wrangler dev on localhost).
 * Writes <out-dir>/www (the app, like npm run serve), worker.mjs and wrangler.json (the brand as the variable BRAND).
 * Then: npx wrangler deploy --config <out-dir>/wrangler.json   (or wrangler dev to try it locally).
 * Exit code 0 = written, 1 = error (nothing is written). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {buildPreview} = require('./preview');
const {checkBrandJson} = require('./deploy');

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
  if (errors.length) throw new Error(errors.join('\n'));
  return s;
}

function assemble({brand, outDir}) {
  if (!fs.existsSync(path.join(brand, 'brand.json'))) throw new Error(`Cannot find brand.json in ${brand}`);
  const {text, errors} = checkBrandJson(path.join(brand, 'brand.json'));
  if (errors.length) throw new Error(`brand.json:\n  ${errors.join('\n  ')}`);
  const settings = readSettings(brand);
  if (!fs.existsSync(WORKER)) throw new Error('The API is not built: run npm run build first.');
  // Everything is built in a temporary folder first, so an error never leaves a half-written publish folder
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-cloudflare-'));
  try {
    buildPreview({outDir: path.join(tmp, 'www'), brand, api: true});
    fs.copyFileSync(WORKER, path.join(tmp, 'worker.mjs'));
    const config = {
      name: settings.name,
      main: 'worker.mjs',
      compatibility_date: COMPATIBILITY_DATE,
      ...(settings.accountId ? {account_id: settings.accountId} : {}),
      ...(settings.routes ? {routes: settings.routes} : {}),
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
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
  return {outDir, access: !!settings.access};
}

function main(argv) {
  try {
    const {outDir: out, access} = assemble(parseArgs(argv));
    console.log(`  Cloudflare folder written: ${out}`);
    if (!access) console.log('  WARNING: no "access" in cloudflare.json: the Worker will refuse every request until Cloudflare Access is set up.');
    console.log(`  Publish: npx wrangler deploy --config ${path.join(out, 'wrangler.json')}`);
    return 0;
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    return 1;
  }
}

module.exports = {assemble, COMPATIBILITY_DATE};
if (require.main === module) process.exitCode = main(process.argv.slice(2));
