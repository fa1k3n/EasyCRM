'use strict';
/* Builds a local preview of the CRM with made-up example customers (no real data).
 * Usage: node tools/preview.js [--out-dir <folder>] [--brand <folder with brand.json>]   (npm run preview -- ...)
 * The React app (app/) is built with tools/build-app.js, with the brand folder's extensions/ if it has any.
 * Without --brand, profile/ in the repo root is used if it has a brand.json, otherwise the default brand
 * (the example company in logic.js). Then open <out-dir>/preview.html in the browser; its path is printed.
 * Exit code 0 = the preview is written, 1 = error. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const IMAGES = ['.png', '.svg', '.jpg', '.jpeg', '.webp'];

function parseArgs(argv) {
  const args = {outDir: path.join(os.tmpdir(), 'crm-preview'), brand: ''};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else if (argv[i] === '--brand' && argv[i + 1]) args.brand = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  return args;
}

/* Writes preview.html (the React app's page fragment with the fake database loaded first), app.js, app.css, logic.js, the stub, the example logo and,
 * with a brand, brand.js (window.BRAND) and the brand's images, just like publishing.
 * Returns the path of preview.html. */
function buildPreview({outDir, brand}) {
  if (!brand && fs.existsSync(path.join(ROOT, 'profile', 'brand.json'))) brand = path.join(ROOT, 'profile');
  if (brand && !fs.existsSync(path.join(brand, 'brand.json'))) throw new Error(`Cannot find brand.json in ${brand}`);
  fs.mkdirSync(outDir, {recursive: true});
  for (const old of ['app.js', 'app.css']) fs.rmSync(path.join(outDir, old), {force: true});
  const page = buildReactPage(outDir, brand);
  const html = '<!doctype html><html lang="sv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<style>body{margin:0}[hidden]{display:none!important}</style>' +
    '<script src="preview-stub.js"></script></head><body>\n' + page + '\n</body></html>';
  fs.writeFileSync(path.join(outDir, 'preview.html'), html, 'utf8');
  fs.copyFileSync(path.join(ROOT, 'kundregister', 'logic.js'), path.join(outDir, 'logic.js'));
  fs.copyFileSync(path.join(ROOT, 'tools', 'preview-stub.js'), path.join(outDir, 'preview-stub.js'));
  fs.copyFileSync(path.join(ROOT, 'kundregister', 'logo.svg'), path.join(outDir, 'logo.svg'));
  fs.rmSync(path.join(outDir, 'brand.js'), {force: true});
  if (brand) {
    const json = fs.readFileSync(path.join(brand, 'brand.json'), 'utf8').replace(/^\uFEFF/, '');
    fs.writeFileSync(path.join(outDir, 'brand.js'), `window.BRAND = ${json};\n`, 'utf8');
    for (const e of fs.readdirSync(brand, {withFileTypes: true})) {
      if (e.isFile() && IMAGES.includes(path.extname(e.name).toLowerCase())) fs.copyFileSync(path.join(brand, e.name), path.join(outDir, e.name));
    }
  }
  return path.join(outDir, 'preview.html');
}

/* Builds the React app (with the brand folder's extensions/, if any) into a temporary folder, copies app.js and
 * app.css to the preview and returns the page fragment. */
function buildReactPage(outDir, brand) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-preview-app-'));
  try {
    const extDir = brand ? path.join(brand, 'extensions') : '';
    const ext = extDir && fs.existsSync(extDir) ? ['--extensions', extDir] : [];
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-app.js'), '--out-dir', tmp, ...ext], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(`The React app could not be built:\n${r.stdout}${r.stderr}`);
    for (const f of ['app.js', 'app.css']) fs.copyFileSync(path.join(tmp, f), path.join(outDir, f));
    return fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

function main(argv) {
  try {
    console.log(buildPreview(parseArgs(argv)));
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

module.exports = {buildPreview};
if (require.main === module) process.exitCode = main(process.argv.slice(2));
