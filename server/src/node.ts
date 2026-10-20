/* The local server: the API on Node with SQLite, listening on 127.0.0.1 only, with the brand folder's brand.json
 * (the logic's rules and texts follow its language).
 * Usage: node server/dist/node.mjs [--port <port>] [--db <file>] [--brand <folder with brand.json>] [--static <folder>]
 *   (default port 8787, default brand folder profile/ when it exists, default database <brand folder>/data/crm.sqlite;
 *   --static serves the app's files from the folder outside /api/, as npm run serve does) */
import fs from 'node:fs';
import path from 'node:path';
import type {AddressInfo} from 'node:net';
import {serve} from '@hono/node-server';
import {serveStatic} from '@hono/node-server/serve-static';
import {setBrand} from '../../crm/logic/brand';
import {createApp} from './app';
import {openSqlite} from './sqlite';

export const HOST = '127.0.0.1';
export const DEFAULT_PORT = 8787;

export interface Running { host: string; port: number; close(): Promise<void> }

/* Sets the brand from <dir>/brand.json and returns it; without the file the logic's built-in example brand is used
 * (null). A brand that does not pass validateBrand throws with the file's name. */
export function loadBrand(dir: string): Brand | null {
  const file = path.join(dir, 'brand.json');
  if (!fs.existsSync(file)) { setBrand(null); return null; }
  try {
    const brand = JSON.parse(fs.readFileSync(file, 'utf8')) as Brand;
    setBrand(brand);
    return brand;
  } catch (e) {
    throw new Error(`${file}: ${(e as Error).message}`);
  }
}

export interface StartOptions {
  port?: number;
  dbFile: string;
  /** the folder with brand.json */
  brandDir?: string;
  /** a folder with the app's files, served outside /api/ */
  staticDir?: string;
}

export async function start({port = DEFAULT_PORT, dbFile, brandDir, staticDir}: StartOptions): Promise<Running> {
  if (brandDir) loadBrand(brandDir);
  fs.mkdirSync(path.dirname(dbFile), {recursive: true});
  const db = openSqlite(dbFile);
  const app = createApp({db, local: true, assets: staticDir ? serveStatic({root: path.resolve(staticDir)}) : undefined});
  return new Promise((resolve, reject) => {
    const server = serve({fetch: app.fetch, port, hostname: HOST}, info => {
      resolve({
        host: HOST,
        port: (info as AddressInfo).port,
        close: () => new Promise<void>(done => server.close(() => { db.close(); done(); }))
      });
    });
    server.once('error', reject);
  });
}

function parseArgs(argv: string[]) {
  const args: StartOptions & {port: number} = {port: DEFAULT_PORT, dbFile: ''};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--port' && argv[i + 1]) args.port = Number(argv[++i]);
    else if (argv[i] === '--db' && argv[i + 1]) args.dbFile = path.resolve(argv[++i]);
    else if (argv[i] === '--brand' && argv[i + 1]) args.brandDir = path.resolve(argv[++i]);
    else if (argv[i] === '--static' && argv[i + 1]) args.staticDir = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  if (!args.brandDir && fs.existsSync('profile')) args.brandDir = path.resolve('profile');
  if (args.brandDir && !fs.existsSync(args.brandDir)) throw new Error(`The brand folder does not exist: ${args.brandDir}`);
  if (!args.dbFile) args.dbFile = path.resolve(args.brandDir ?? 'profile', 'data', 'crm.sqlite');
  if (!Number.isInteger(args.port) || args.port < 0 || args.port > 65535) throw new Error('--port must be a port number');
  return args;
}

/* Started as a program (the built server/dist/node.mjs), not imported by the tests */
export async function main(argv: string[]) {
  try {
    const args = parseArgs(argv);
    const running = await start(args);
    console.log(`  CRM API on http://${running.host}:${running.port}/api/v1/`);
    if (args.staticDir) console.log(`  App on http://${running.host}:${running.port}/`);
  } catch (e) {
    console.error(`[ERROR] ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
