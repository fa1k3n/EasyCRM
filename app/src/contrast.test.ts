/* The fixed status colours in styles.css must keep text readable (WCAG AA 4.5:1) in light and dark mode,
 * e.g. the white "Kontakta" text on the red badge. */
import fs from 'fs';
import path from 'path';

const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
const block = (re: RegExp) => { const m = css.match(re); if (!m) throw new Error('block missing'); return m[1]; };
const value = (text: string, name: string) => { const m = text.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i')); if (!m) throw new Error(`--${name} missing`); return m[1]; };
const light = block(/:root \{([^}]*)\}/);
const dark = block(/:root:not\(\[data-theme="light"\]\) \{([^}]*)\}/);

test.each([['light', light], ['dark', dark]])('%s mode: text on the red badge is readable', (_mode, text) => {
  expect(window.CRMLogic.contrastRatio(value(text, 'tally-ink'), value(text, 'tally'))).toBeGreaterThanOrEqual(4.5);
});
