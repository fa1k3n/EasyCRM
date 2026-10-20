'use strict';
/* Builds the REST API (server/) with Vite into one file per place it runs:
 *   node.mjs    the local server with Hono built in (node node.mjs [--port <port>] [--db <file>] [--brand <folder>] [--static <folder>])
 *   worker.mjs  the same API for Cloudflare Workers with D1 (tools/cloudflare.js puts it in the publish folder)
 * Usage: node tools/build-server.js [--out-dir <folder>]   (default server/dist; part of npm run build)
 * Exit code 0 = built, 1 = error. */
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER = path.join(ROOT, 'server');

function parseArgs(argv) {
  const args = {outDir: path.join(SERVER, 'dist')};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  return args;
}

async function buildServer({outDir}) {
  const {build} = await import('vite');
  // Everything from npm is built in, so the files run without node_modules; Node's own modules stay imports
  const one = (entry, file, target, emptyOutDir) => build({
    configFile: false,
    root: SERVER,
    logLevel: 'warn',
    mode: 'production',
    ssr: {noExternal: true, target},
    build: {
      outDir,
      emptyOutDir,
      ssr: path.join(SERVER, 'src', entry),
      target: target === 'node' ? 'node24' : 'es2022',
      rolldownOptions: {output: {format: 'esm', entryFileNames: file, codeSplitting: false}}
    }
  });
  await one('cli.ts', 'node.mjs', 'node', true);
  await one('worker.ts', 'worker.mjs', 'webworker', false);
  return {outDir};
}

async function main(argv) {
  try {
    const {outDir} = await buildServer(parseArgs(argv));
    console.log(`  REST API built to ${path.relative(process.cwd(), outDir) || '.'} (node.mjs, worker.mjs).`);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

module.exports = {buildServer};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
