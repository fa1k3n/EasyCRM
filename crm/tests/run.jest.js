/* Runs the logic's tests in jest (jsdom): the files are loaded as classic scripts in this order and share one global
 * scope. harness.js provides eq/ok/includes/excludes, and every test in logic.test.js, brand.test.js and
 * mail-api.test.js registers with jest's describe/test.
 * The test files themselves are not changed. */
const fs = require('fs');
const path = require('path');

const FILES = ['../logic.js', 'harness.js', 'test-brand.js', 'logic.test.js', 'brand.test.js', 'mail-api.test.js'];
// Added later (a new line, so the list above is unchanged)
FILES.push('validate.test.js');
FILES.push('item-patches.test.js');

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

for (const rel of FILES) loadScript(rel);
