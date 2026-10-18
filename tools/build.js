'use strict';
/* Type-checks and builds TypeScript with the typescript package from npm.
 * Default: kundregister/logic.ts -> kundregister/logic.js. With --project another folder with a tsconfig.json is built
 * (e.g. a private mail plugin).
 * Usage: node tools/build.js [--project <folder with tsconfig.json>]   (npm run build [-- --project <folder>])
 * Exit code 0 = no type errors and the built .js files are up to date, 1 = type or build errors (no files are written). */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PROJECT = path.join(ROOT, 'kundregister');

function parseArgs(argv) {
  const i = argv.indexOf('--project');
  if (i === -1) return {project: DEFAULT_PROJECT};
  if (!argv[i + 1]) throw new Error('--project needs a folder');
  return {project: path.resolve(argv[i + 1])};
}

/* Builds the project in memory and only writes the files when there are no diagnostics at all,
 * so that a type error never leaves a half-built or stale-but-rewritten file behind.
 * Returns {ok, version, diagnostics (text), written: [{name, changed}]}. */
function build(projectDir) {
  const result = {ok: false, version: ts.version, diagnostics: '', written: []};
  const fmtHost = {getCanonicalFileName: p => p, getCurrentDirectory: () => projectDir, getNewLine: () => '\n'};
  const configFile = path.join(projectDir, 'tsconfig.json');
  if (!fs.existsSync(configFile)) { result.diagnostics = `Cannot find tsconfig.json in ${projectDir}`; return result; }
  const configErrors = [];
  const parsed = ts.getParsedCommandLineOfConfigFile(configFile, {}, {
    ...ts.sys, onUnRecoverableConfigFileDiagnostic: d => configErrors.push(d)
  });
  if (!parsed) { result.diagnostics = ts.formatDiagnostics(configErrors, fmtHost); return result; }
  const outputs = new Map();
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  let diags = [...configErrors, ...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  if (!diags.length) diags = program.emit(undefined, (name, text) => outputs.set(name, text)).diagnostics.slice();
  if (diags.length) { result.diagnostics = ts.formatDiagnostics(diags, fmtHost); return result; }
  if (!outputs.size) { result.diagnostics = 'The compiler wrote no files.'; return result; }
  for (const [name, text] of outputs) {
    // Git on Windows may have checked the file out with CRLF; compare independently of line endings
    const old = fs.existsSync(name) ? fs.readFileSync(name, 'utf8').replace(/\r\n/g, '\n') : null;
    const changed = old !== text;
    if (changed) fs.writeFileSync(name, text, 'utf8');
    result.written.push({name: path.relative(projectDir, name), changed});
  }
  result.ok = true;
  return result;
}

function main(argv) {
  let args;
  try { args = parseArgs(argv); } catch (e) { console.error(e.message); return 1; }
  const r = build(args.project);
  if (!r.ok) {
    console.error(`TypeScript ${r.version}: type check failed in ${args.project}, no files were updated.`);
    console.error(r.diagnostics);
    return 1;
  }
  for (const f of r.written) console.log(`  TypeScript ${r.version}: no type errors, ${f.name} ${f.changed ? 'updated' : 'already up to date'}.`);
  return 0;
}

module.exports = {build, parseArgs, DEFAULT_PROJECT};
if (require.main === module) process.exitCode = main(process.argv.slice(2));
