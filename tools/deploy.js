'use strict';
/* Checks a brand and assembles a publish folder for the CRM.
 * Usage: node tools/deploy.js [--brand <folder with brand.json>] [--out-dir <folder>]   (npm run deploy -- ...)
 *   Without --brand, varumarke/ in the repo root is used (ignored by git; create it with  cp -r exempel varumarke ).
 *   1. brand.json is checked with the app's own check (validateBrand): valid JSON, required fields, colours,
 *      contrast (WCAG AA 4.5:1), unique customer type ids and that every sender a customer type points to exists.
 *   2. The images in the brand folder (png, svg, jpg, jpeg, webp) may be at most 1 MB, and the logo must exist.
 *   3. A mail plugin in TypeScript (mail/tsconfig.json) is built with tools/build.js against the contract
 *      kundregister/mail-api.d.ts; otherwise a ready mail/mail.js is included as it is.
 *   4. The brand's own tests (run-tests.js in the brand folder, called with --repo <repo>) and the repo's tests
 *      (npm test) are run.
 *   5. The publish folder (default: <brand folder>/publicera) gets index.html, logic.js, brand.js, the images and any mail.js.
 * --skip-repo-tests skips the repo's tests (used by the tests of this script, which are part of the repo's tests).
 * Exit code 0 = the publish folder is ready, 1 = an error (then nothing is written). */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];
const MAX_IMAGE = 1024 * 1024;
const PUBLISHED = ['index.html', 'logic.js', 'brand.js', 'mail.js'];

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
  const L = require(path.join(ROOT, 'kundregister', 'logic.js'));
  const text = fs.readFileSync(brandFile, 'utf8').replace(/^\uFEFF/, '');
  let b;
  try { b = JSON.parse(text); } catch (e) { return {errors: [`brand.json is not valid JSON: ${e.message}`]}; }
  if (b === null || typeof b !== 'object' || Array.isArray(b)) return {errors: ['brand.json must be an object ({ ... })']};
  const errors = [...L.validateBrand(b)];
  // The app shows the brand anyway, but when publishing too low contrast counts as an error
  if (b.colors) { try { errors.push(...L.deriveColors(b.colors).warnings); } catch { /* an invalid colour is already reported by validateBrand */ } }
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
    brandDir = path.join(ROOT, 'varumarke');
    if (!fs.existsSync(brandDir)) fail(`The folder varumarke/ is missing in ${ROOT}. Create it from the example and fill in brand.json: cp -r exempel varumarke (or give --brand <folder>).`);
  }
  brandDir = path.resolve(brandDir);
  if (!fs.statSync(brandDir, {throwIfNoEntry: false})?.isDirectory()) fail(`The brand folder does not exist: ${brandDir}`);
  const brandFile = path.join(brandDir, 'brand.json');
  if (!fs.existsSync(brandFile)) fail(`Cannot find brand.json in ${brandDir} (copy exempel/brand.json and fill it in)`);
  const out = path.resolve(args.outDir || path.join(brandDir, 'publicera'));
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

  // ---------- 3. The mail plugin ----------
  const mailDir = path.join(brandDir, 'mail');
  if (fs.existsSync(path.join(mailDir, 'tsconfig.json'))) {
    console.log('== Mail plugin (mail/) ==');
    fs.copyFileSync(path.join(ROOT, 'kundregister', 'mail-api.d.ts'), path.join(mailDir, 'mail-api.d.ts'));
    if (run(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--project', mailDir]) !== 0) fail(`The mail plugin in ${mailDir} could not be built (see the type errors above).`);
    if (!fs.existsSync(path.join(mailDir, 'mail.js'))) fail('The mail plugin was built but gave no mail/mail.js (is the source file called mail.ts?).');
  }
  const mailJs = path.join(mailDir, 'mail.js');
  const hasMail = fs.existsSync(mailJs);

  // ---------- 4. Tests ----------
  if (fs.existsSync(path.join(brandDir, 'run-tests.js'))) {
    console.log('== The brand\'s own tests (run-tests.js) ==');
    if (run(process.execPath, [path.join(brandDir, 'run-tests.js'), '--repo', ROOT]) !== 0) fail(`The brand's tests in ${brandDir} failed.`);
  } else if (fs.existsSync(path.join(brandDir, 'run-tests.ps1'))) {
    fail(`The brand folder has run-tests.ps1, but the tools now run on Node: port the tests to run-tests.js (called as node run-tests.js --repo <repo>).`);
  }
  if (args.skipRepoTests) console.log('  The repo\'s tests were skipped (--skip-repo-tests).');
  else {
    console.log('== The repo\'s tests (npm test) ==');
    if (run('npm', ['test'], {cwd: ROOT}) !== 0) fail('The repo\'s tests failed.');
  }

  // ---------- 5. The publish folder ----------
  fs.mkdirSync(out, {recursive: true});
  for (const e of fs.readdirSync(out, {withFileTypes: true})) if (e.isFile()) fs.rmSync(path.join(out, e.name));
  for (const f of ['index.html', 'logic.js']) fs.copyFileSync(path.join(ROOT, 'kundregister', f), path.join(out, f));
  fs.writeFileSync(path.join(out, 'brand.js'), `window.BRAND = ${check.text.trim()};\n`, 'utf8');
  for (const name of images) fs.copyFileSync(path.join(brandDir, name), path.join(out, name));
  if (hasMail) fs.copyFileSync(mailJs, path.join(out, 'mail.js'));
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
