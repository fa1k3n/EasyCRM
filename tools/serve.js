'use strict';
/* The app and the REST API on localhost (npm run serve): builds the React app with the brand folder (brand.js, logic.js,
 * images and the brand's extensions/, like the preview but without the fake database) and starts the built server
 * (server/dist/node.mjs, from npm run build), which serves the app on / and the API on /api/v1/ on 127.0.0.1 only.
 * Usage: node tools/serve.js [--brand <folder with brand.json>] [--port <port>] [--db <file>] [--out-dir <folder>]
 *   Without --brand: profile/ in the repo root if it has a brand.json, otherwise the logic's example brand.
 *   Without --db: <brand folder>/data/crm.sqlite. --out-dir: where the app is built (default a temporary folder).
 * Stops with Ctrl+C. Exit code 1 on an error. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');
const {buildPreview} = require('./preview');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'dist', 'node.mjs');

function parseArgs(argv) {
  const args = {brand: '', port: '', db: '', outDir: path.join(os.tmpdir(), 'crm-serve')};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--brand' && argv[i + 1]) args.brand = path.resolve(argv[++i]);
    else if (argv[i] === '--port' && argv[i + 1]) args.port = argv[++i];
    else if (argv[i] === '--db' && argv[i + 1]) args.db = path.resolve(argv[++i]);
    else if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  if (!args.brand && fs.existsSync(path.join(ROOT, 'profile', 'brand.json'))) args.brand = path.join(ROOT, 'profile');
  return args;
}

function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
    if (!fs.existsSync(SERVER)) throw new Error('The server is not built: run npm run build first (npm run serve does).');
    buildPreview({outDir: args.outDir, brand: args.brand, api: true});
  } catch (e) {
    console.error(`[ERROR] ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const serverArgs = ['--static', args.outDir];
  if (args.brand) serverArgs.push('--brand', args.brand);
  if (args.port) serverArgs.push('--port', args.port);
  if (args.db) serverArgs.push('--db', args.db);
  const child = spawn(process.execPath, [SERVER, ...serverArgs], {cwd: ROOT, stdio: 'inherit'});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('exit', code => { process.exitCode = code ?? 0; });
}

if (require.main === module) main(process.argv.slice(2));
