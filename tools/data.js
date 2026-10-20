'use strict';
/* Moves the register's data between claude.ai and the REST API as one JSON file (the export format):
 *   {"format": "crm-export", "version": 1, "exportedAt": "…", "collections": {"customers": {"<id>": {…}}, "skipped": {…}, "sync": {…}}}
 * Usage:
 *   node tools/data.js pack <backup folder> --out <file>        backup folder (ArtifactData list: <collection>/<id>.json) → file
 *   node tools/data.js unpack <file> --out-dir <empty folder>     file → backup folder (restore it on claude.ai with ArtifactData batch)
 *   node tools/data.js pull --url <server> --out <file>           the server's GET /api/v1/export → file
 *   node tools/data.js push <file> --url <server> [--dry-run]     file → the server's POST /api/v1/import (never removes anything)
 * <server> is e.g. http://127.0.0.1:8787, or the cloud address: then the environment variables CF_ACCESS_CLIENT_ID and
 * CF_ACCESS_CLIENT_SECRET (an Access service token; never in the repo) are sent as Access headers.
 * Exit code 0 = done, 1 = error. Prints counts, and the ids of customers and sync documents; never customer data, the
 * keys of removed suggestions (a company's name or domain) or the token. */
const fs = require('fs');
const path = require('path');

const COLLECTIONS = ['customers', 'skipped', 'sync'];
const USAGE = 'Usage: node tools/data.js pack <backup folder> --out <file> | unpack <file> --out-dir <folder> | pull --url <server> --out <file> | push <file> --url <server> [--dry-run]';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const args = {command, input: '', out: '', outDir: '', url: '', dryRun: false};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--out' && rest[i + 1]) args.out = path.resolve(rest[++i]);
    else if (rest[i] === '--out-dir' && rest[i + 1]) args.outDir = path.resolve(rest[++i]);
    else if (rest[i] === '--url' && rest[i + 1]) args.url = rest[++i].replace(/\/+$/, '');
    else if (rest[i] === '--dry-run') args.dryRun = true;
    else if (!rest[i].startsWith('--') && !args.input) args.input = path.resolve(rest[i]);
    else throw new Error(`Unknown or incomplete argument: ${rest[i]}\n${USAGE}`);
  }
  const need = {pack: ['input', 'out'], unpack: ['input', 'outDir'], pull: ['url', 'out'], push: ['input', 'url']}[command];
  if (!need) throw new Error(USAGE);
  for (const k of need) if (!args[k]) throw new Error(`${command} needs ${k === 'input' ? 'a file or folder' : '--' + k.replace('outDir', 'out-dir')}\n${USAGE}`);
  return args;
}

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
const counts = file => COLLECTIONS.map(n => `${Object.keys(file.collections[n] || {}).length} ${n}`).join(', ');

function readExport(file) {
  const data = readJson(file);
  if (!data || data.format !== 'crm-export' || data.version !== 1 || typeof data.collections !== 'object') {
    throw new Error(`${file} is not an export file (format "crm-export", version 1)`);
  }
  return data;
}

// The backup folder's collections: <folder>/<collection>/<id>.json; everything else in the folder is left out
function pack(folder) {
  if (!fs.existsSync(folder)) throw new Error(`The folder does not exist: ${folder}`);
  const collections = {};
  for (const name of COLLECTIONS) {
    collections[name] = {};
    const dir = path.join(folder, name);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()) collections[name][f.slice(0, -5)] = readJson(path.join(dir, f));
  }
  return {format: 'crm-export', version: 1, exportedAt: new Date().toISOString(), collections};
}

function unpack(file, outDir) {
  if (fs.existsSync(outDir) && fs.readdirSync(outDir).length) throw new Error(`The folder is not empty: ${outDir}`);
  for (const name of COLLECTIONS) {
    const docs = file.collections[name] || {};
    if (!Object.keys(docs).length) continue;
    fs.mkdirSync(path.join(outDir, name), {recursive: true});
    for (const [id, doc] of Object.entries(docs)) {
      if (!id || /[\\/]|^\.\.?$/.test(id)) throw new Error(`An id cannot be a file name: ${name}/${id}`);
      fs.writeFileSync(path.join(outDir, name, `${id}.json`), JSON.stringify(doc, null, 2) + '\n', 'utf8');
    }
  }
}

// An Access service token from the environment, for a server behind Cloudflare Access
function accessHeaders() {
  const id = process.env.CF_ACCESS_CLIENT_ID, secret = process.env.CF_ACCESS_CLIENT_SECRET;
  return id && secret ? {'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret} : {};
}

async function request(url, init = {}) {
  const res = await fetch(url, {...init, headers: {...(init.headers || {}), ...accessHeaders()}});
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body && body.error;
    const details = e && e.details ? '\n' + e.details.map(d => `  ${d.path}: ${d.message}`).join('\n') : '';
    throw new Error(`The server answered ${res.status}: ${e ? e.message : 'no message'}${details}`);
  }
  return body;
}

const sum = byCollection => Object.values(byCollection).reduce((n, ids) => n + ids.length, 0);

async function main(argv) {
  try {
    const args = parseArgs(argv);
    if (args.command === 'pack') {
      const file = pack(args.input);
      fs.writeFileSync(args.out, JSON.stringify(file, null, 2) + '\n', 'utf8');
      console.log(`  Packed ${counts(file)} into ${args.out}`);
    } else if (args.command === 'unpack') {
      const file = readExport(args.input);
      unpack(file, args.outDir);
      console.log(`  Unpacked ${counts(file)} into ${args.outDir}`);
    } else if (args.command === 'pull') {
      const file = await request(`${args.url}/api/v1/export`);
      fs.writeFileSync(args.out, JSON.stringify(file, null, 2) + '\n', 'utf8');
      console.log(`  Pulled ${counts(file)} into ${args.out}`);
    } else {
      const file = readExport(args.input);
      const r = await request(`${args.url}/api/v1/import${args.dryRun ? '?dryRun=1' : ''}`,
        {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(file)});
      console.log(`  ${r.dryRun ? 'Dry run: would create' : 'Imported: created'} ${sum(r.create)}, update${r.dryRun ? '' : 'd'} ${sum(r.update)}, unchanged ${r.unchanged}`);
      // A removed suggestion's key is a company's name or domain: only counted
      for (const name of COLLECTIONS.filter(n => n !== 'skipped')) {
        if (r.create[name].length) console.log(`    new ${name}: ${r.create[name].join(', ')}`);
        if (r.update[name].length) console.log(`    changed ${name}: ${r.update[name].join(', ')}`);
      }
    }
    return 0;
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    return 1;
  }
}

module.exports = {pack, unpack};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
