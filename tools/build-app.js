'use strict';
/* Builds the React app (app/) with Vite into the files that are published as an artifact:
 *   index.html  page fragment (claude.ai adds the document around it) that loads brand.js, logic.js and app.js
 *   app.js      the app as one self-contained script
 *   app.css     Tailwind's output
 * Usage: node tools/build-app.js [--out-dir <folder>] [--extensions <folder>]   (default app/dist; part of npm run build)
 *   --extensions: the brand folder's extensions (profile/extensions), built together with the app. Each .ts/.tsx file
 *   directly in the folder, and each subfolder's index.ts(x), is one extension whose default export is its manifest
 *   (app/src/extensions/api.ts, imported as 'crm-extension-api'). They are type-checked first; a type or syntax error
 *   stops the build.
 * Exit code 0 = built, 1 = error. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawnSync} = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'app');

function parseArgs(argv) {
  const args = {outDir: path.join(APP, 'dist'), extensions: ''};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out-dir' && argv[i + 1]) args.outDir = path.resolve(argv[++i]);
    else if (argv[i] === '--extensions' && argv[i + 1]) args.extensions = path.resolve(argv[++i]);
    else throw new Error(`Unknown or incomplete argument: ${argv[i]}`);
  }
  return args;
}

const API = path.join(APP, 'src', 'extensions', 'api.ts');
const VIRTUAL = 'virtual:crm-extensions';

// The extensions' entry files: .ts/.tsx directly in the folder, and index.ts(x) in each subfolder
function findExtensions(dir) {
  if (!fs.statSync(dir, {throwIfNoEntry: false})?.isDirectory()) throw new Error(`The extensions folder does not exist: ${dir}`);
  const entries = [];
  for (const e of fs.readdirSync(dir, {withFileTypes: true}).sort((a, b) => a.name.localeCompare(b.name))) {
    if (e.isFile() && /\.tsx?$/.test(e.name) && !/\.(d|test)\.tsx?$/.test(e.name)) entries.push(path.join(dir, e.name));
    else if (e.isDirectory()) {
      const index = ['index.tsx', 'index.ts'].map(f => path.join(dir, e.name, f)).find(f => fs.existsSync(f));
      if (index) entries.push(index);
    }
  }
  return entries;
}

// Type check of the extensions against the API, with the app's settings (tools/build.js on a temporary tsconfig)
function typeCheck(entries) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'crm-ext-check-'));
  try {
    const app = JSON.parse(fs.readFileSync(path.join(APP, 'tsconfig.json'), 'utf8')).compilerOptions;
    const nm = path.join(ROOT, 'node_modules');
    fs.writeFileSync(path.join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {...app, paths: {'crm-extension-api': [API], '*': [path.join(nm, '@types', '*'), path.join(nm, '*')]}},
      files: [...entries, path.join(ROOT, 'kundregister', 'logic', 'types.ts'), path.join(APP, 'src', 'env.d.ts')]
    }));
    const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build.js'), '--project', dir], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(`An extension has type errors:\n${r.stdout}${r.stderr}`);
  } finally {
    fs.rmSync(dir, {recursive: true, force: true});
  }
}

// The module 'virtual:crm-extensions': the extensions' manifests as one list (empty without extensions)
function extensionsPlugin(entries) {
  return {
    name: 'crm-extensions',
    resolveId: id => (id === VIRTUAL ? '\0' + VIRTUAL : null),
    load: id => (id === '\0' + VIRTUAL
      ? entries.map((f, i) => `import e${i} from ${JSON.stringify(f)};`).join('\n') + `\nexport default [${entries.map((_, i) => `e${i}`).join(', ')}];\n`
      : null)
  };
}

// Tailwind only looks for class names inside app/; the extensions' folder is added as a source to the app's styles.css
function tailwindSourcePlugin(dir) {
  return {
    name: 'crm-extensions-tailwind-source',
    enforce: 'pre',
    transform: (code, id) => (dir && id.split('?')[0] === path.join(APP, 'src', 'styles.css') ? `${code}\n@source ${JSON.stringify(dir)};\n` : null)
  };
}

async function buildApp({outDir, extensions = ''}) {
  // Always a production build (React and the JSX transform alike), also when run from the tests (NODE_ENV=test)
  process.env.NODE_ENV = 'production';
  const entries = extensions ? findExtensions(extensions) : [];
  if (entries.length) typeCheck(entries);
  const {build} = await import('vite');
  const tailwindcss = (await import('@tailwindcss/vite')).default;
  await build({
    configFile: false,
    root: APP,
    logLevel: 'warn',
    plugins: [extensionsPlugin(entries), tailwindSourcePlugin(entries.length ? extensions : ''), tailwindcss()],
    // The extensions live outside app/: their imports of React and the API resolve to the app's own copies
    resolve: {alias: {'crm-extension-api': API}, dedupe: ['react', 'react-dom', 'lucide-react']},
    // Classic React JSX (react-jsx) from app/tsconfig.json, production mode
    mode: 'production',
    build: {
      outDir,
      emptyOutDir: true,
      // The app is loaded as a plain script (like logic.js), so it is built as one self-contained file
      rolldownOptions: {
        input: path.join(APP, 'src', 'main.tsx'),
        // lucide-react marks its files "use client" (for server-rendered React); meaningless in this app, so that one
        // message is dropped and real warnings stay visible
        onLog(level, log, handler) { if (log.code !== 'MODULE_LEVEL_DIRECTIVE') handler(level, log); },
        output: {format: 'iife', entryFileNames: 'app.js', assetFileNames: 'app[extname]', codeSplitting: false}
      },
      cssCodeSplit: false
    }
  });
  fs.copyFileSync(path.join(APP, 'index.html'), path.join(outDir, 'index.html'));
  return {outDir, count: entries.length};
}

async function main(argv) {
  try {
    const {outDir, count} = await buildApp(parseArgs(argv));
    const ext = count ? `, with ${count} extension${count === 1 ? '' : 's'}` : '';
    console.log(`  React app built to ${path.relative(process.cwd(), outDir) || '.'} (index.html, app.js, app.css)${ext}.`);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

module.exports = {buildApp};
if (require.main === module) main(process.argv.slice(2)).then(code => { process.exitCode = code; });
