/* Loads the shared logic (kundregister/logic.js) into the jsdom window before each UI test file, the same way the page
 * does: as a plain script, so that window.CRMLogic exists. The brand is reset for every file. */
const fs = require('fs');
const path = require('path');

const script = document.createElement('script');
script.textContent = fs.readFileSync(path.join(__dirname, '..', '..', 'kundregister', 'logic.js'), 'utf8');
document.head.appendChild(script);
delete window.BRAND;
