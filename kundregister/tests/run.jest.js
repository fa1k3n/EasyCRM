/* Runs the browser tests in jest (jsdom), exactly like run.html: the files are loaded as classic scripts in the same
 * order and share one global scope. harness.js provides eq/ok/includes/excludes; its own describe/test are replaced
 * by jest's, so every test in logic.test.js, brand.test.js and mail-api.test.js becomes a jest test.
 * The test files themselves are not changed. */
const fs = require('fs');
const path = require('path');

const FILES = ['../logic.js', 'harness.js', 'test-brand.js', 'logic.test.js', 'brand.test.js', 'mail-api.test.js'];

// Runs a file as a <script>, like the browser does; an error in it fails the whole run instead of disappearing.
function loadScript(rel) {
  const file = path.join(__dirname, rel);
  let error = null;
  const onError = e => { error = e.error || new Error(e.message); };
  window.addEventListener('error', onError);
  const s = document.createElement('script');
  s.textContent = fs.readFileSync(file, 'utf8') + `\n//# sourceURL=${file}`;
  document.head.appendChild(s);
  window.removeEventListener('error', onError);
  if (error) throw new Error(`${rel}: ${error.message}`);
}

const jestApi = {describe: global.describe, test: global.test};
for (const rel of FILES) {
  loadScript(rel);
  // harness.js sets its own describe/test; the tests should register with jest instead
  if (rel === 'harness.js') Object.assign(window, jestApi);
}
