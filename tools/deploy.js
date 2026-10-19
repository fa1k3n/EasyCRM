'use strict';
/* Checks a brand and assembles a publish folder for the CRM.
 * Usage: node tools/deploy.js [--brand <folder with brand.json>] [--out-dir <folder>]   (npm run deploy -- ...)
 *   Publishes the React app (app/, built with tools/build-app.js, with the brand folder's extensions/).
 *   Without --brand, profile/ in the repo root is used (ignored by git; create it with  cp -r example profile ).
 *   1. brand.json is checked with the app's own check (validateBrand): valid JSON, required fields, colours,
 *      contrast (WCAG AA 4.5:1), unique customer type ids and that every sender a customer type points to exists.
 *   2. The images in the brand folder (png, svg, jpg, jpeg, webp) may be at most 1 MB, and the logo must exist.
 *   3. The brand's own tests (run-tests.js in the brand folder, called with --repo <repo>) and the repo's tests
 *      (npm test) are run.
 *   4. The publish folder (default: <brand folder>/publish) gets index.html, app.js, app.css, logic.js, brand.js and the images.
 *   Mail texts come from an extension with mail (extensions/), built into app.js.
 * --skip-repo-tests skips the repo's tests (used by the tests of this script, which are part of the repo's tests).
 * Exit code 0 = the publish folder is ready, 1 = an error (then nothing is written). */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];
const MAX_IMAGE = 1024 * 1024;
const PUBLISHED = ['index.html', 'logic.js', 'brand.js', 'app.js', 'app.css'];

class DeployError extends Error {
  constructor(errors) { super(errors.join('\n')); this.errors = errors; }
}
const fail = (...errors) => { throw new DeployError(errors); };

function parseArgs(argv) {
  const args = {brand: '', outDir: '', skipRepoTests: false};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--skip-repo-tests') args.skipRepoTests = true;
    else if (argv[i] === '--brand' && argv[i + 1]) args.brand = argv[++i];
    else if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = argv[++i];
    else fail(`Unknown or incomplete argument: ${argv[i]}`);
  }
  return args;
}

// Runs a command with the output passed through; returns the exit code (1 if it could not start)
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {stdio: 'inherit', shell: process.platform === 'win32' && cmd === 'npm', ...opts});
  return r.error ? 1 : r.status;
}

/* 1. brand.json, checked with the app's own logic. Returns {brand, text, errors}. */
function checkBrandJson(brandFile) {
  const L = require(path.join(ROOT, 'crm', 'logic.js'));
  const text = fs.readFileSync(brandFile, 'utf8').replace(/^\uFEFF/, '');
  let b;
  try { b = JSON.parse(text); } catch (e) { return {errors: [`brand.json is not valid JSON: ${e.message}`]}; }
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return {errors: ['brand.json must be an object ({ ... })']};
  const errors = [...L.validateBrand(b)];
  // The app shows the brand anyway, but when publishing too low contrast counts as an error
  if (b.colors) { try { errors.push(...L.deriveColors(b.colors, b.language).warnings); } catch { /* an invalid colour is already reported by validateBrand */ } }
  const ids = Array.isArray(b.senders) ? b.senders.map(s => s && s.id) : [];
  if (Array.isArray(b.customerTypes)) {
    b.customerTypes.forEach((t, i) => { if (t && t.sender && !ids.includes(t.sender)) errors.push(`customerTypes[${i}].sender "${t.sender}" does not exist among senders`); });
  }
  return {brand: b, text, errors};
}

function deploy(args) {
  // ---------- Folders ----------
  let brandDir = args.brand;
  if (!brandDir) {
    brandDir = path.join(ROOT, 'profile');
    if (!fs.existsSync(brandDir)) fail(`The folder profile/ is missing in ${ROOT}. Create it from the example and fill in brand.json: cp -r example profile (or give --brand <folder>).`);
  }
  brandDir = path.resolve(brandDir);
  if (!fs.statSync(brandDir, {throwIfNoEntry: false})?.isDirectory()) fail(`The brand folder does not exist: ${brandDir}`);
  const brandFile = path.join(brandDir, 'brand.json');
  if (!fs.existsSync(brandFile)) fail(`Cannot find brand.json in ${brandDir} (copy example/brand.json and fill it in)`);
  const out = path.resolve(args.outDir || path.join(brandDir, 'publish'));
  // The publish folder is emptied before every run, so it may only contain files that deploy itself writes
  if (fs.existsSync(out)) {
    const foreign = fs.readdirSync(out, {withFileTypes: true})
      .filter(e => e.isDirectory() || !(PUBLISHED.includes(e.name) || IMAGES.includes(path.extname(e.name).toLowerCase()))).map(e => e.name);
    if (foreign.length) fail(`The publish folder ${out} contains other things than deploy writes (${foreign.join(', ')}). Choose another folder with --out-dir.`);
  }
  console.log(`== Brand: ${brandDir} ==`);

  // ---------- 1 and 2. brand.json and the images ----------
  const check = checkBrandJson(brandFile);
  const errors = check.errors;
  const images = fs.readdirSync(brandDir, {withFileTypes: true}).filter(e => e.isFile() && IMAGES.includes(path.extname(e.name).toLowerCase())).map(e => e.name);
  for (const name of images) {
    const size = fs.statSync(path.join(brandDir, name)).size;
    if (size > MAX_IMAGE) errors.push(`The image ${name} is larger than 1 MB (${(size / MAX_IMAGE).toFixed(1)} MB)`);
  }
  const logo = check.brand && typeof check.brand.logo === 'string' ? check.brand.logo : '';
  if (logo && !/^https:\/\//.test(logo) && !fs.existsSync(path.join(brandDir, logo))) errors.push(`The logo ${logo} does not exist in ${brandDir}`);
  if (errors.length) fail(...errors);
  console.log('  brand.json and the images are approved.');

  // ---------- 3. Tests ----------
  if (fs.existsSync(path.join(brandDir, 'run-tests.js'))) {
    console.log('== The brand\'s own tests (run-tests.js) ==');
    if (run(process.execPath, [path.join(brandDir, 'run-tests.js'), '--repo', ROOT]) !== 0) fail(`The brand's tests in ${brandDir} failed.`);
  }
  if (args.skipRepoTests) console.log('  The repo\'s tests were skipped (--skip-repo-tests).');
  else {
    console.log('== The repo\'s tests (npm test) ==');
    if (run('npm', ['test'], {cwd: ROOT}) !== 0) fail('The repo\'s tests failed.');
  }

  // ---------- The React app, built before anything is written ----------
  const appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-deploy-app-'));
  try {
    console.log('== The React app (tools/build-app.js) ==');
    // The brand folder's extensions (extensions/) are built into the app; an error in one stops the publish
    const extDir = path.join(brandDir, 'extensions');
    const ext = fs.existsSync(extDir) ? ['--extensions', extDir] : [];
    if (run(process.execPath, [path.join(ROOT, 'tools', 'build-app.js'), '--out-dir', appDir, ...ext]) !== 0) fail('The React app or an extension could not be built (see above).');

    // ---------- 4. The publish folder ----------
    fs.mkdirSync(out, {recursive: true});
    for (const e of fs.readdirSync(out, {withFileTypes: true})) if (e.isFile()) fs.rmSync(path.join(out, e.name));
    for (const f of ['index.html', 'app.js', 'app.css']) fs.copyFileSync(path.join(appDir, f), path.join(out, f));
    fs.copyFileSync(path.join(ROOT, 'crm', 'logic.js'), path.join(out, 'logic.js'));
  } finally {
    fs.rmSync(appDir, {recursive: true, force: true});
  }
  fs.writeFileSync(path.join(out, 'brand.js'), `window.BRAND = ${check.text.trim()};\n`, 'utf8');
  for (const name of images) fs.copyFileSync(path.join(brandDir, name), path.join(out, name));
  const files = fs.readdirSync(out).sort();
  console.log(`\nThe publish folder is ready: ${out}`);
  console.log(`  The page: index.html. Extra files: ${files.filter(f => f !== 'index.html').join(', ')}`);
  console.log('  Ask Claude to publish index.html as an artifact with the extra files next to it (see README.txt).');
  return out;
}

function main(argv) {
  try {
    deploy(parseArgs(argv));
    return 0;
  } catch (e) {
    if (!(e instanceof DeployError)) throw e;
    console.error('The publish folder was not written:');
    for (const err of e.errors) console.error(`  [ERROR] ${err}`);
    return 1;
  }
}

module.exports = {deploy, checkBrandJson};
if (require.main === module) process.exitCode = main(process.argv.slice(2));
