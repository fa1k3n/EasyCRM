/* Assertions for the logic's tests: eq(), ok(), includes(), excludes(). The tests are run by jest via run.jest.js. */
(function (root) {
  const show = v => { try { return JSON.stringify(v); } catch { return String(v); } };
  const deepEqual = (a, b) => show(a) === show(b);
  root.eq = (actual, expected, msg) => {
    if (!deepEqual(actual, expected)) throw new Error((msg ? msg + ': ' : '') + 'fick ' + show(actual) + ', förväntade ' + show(expected));
  };
  root.ok = (cond, msg) => { if (!cond) throw new Error(msg || 'villkoret var falskt'); };
  root.includes = (text, part, msg) => {
    if (!String(text).includes(part)) throw new Error((msg ? msg + ': ' : '') + 'saknar ' + show(part) + ' i ' + show(text));
  };
  root.excludes = (text, part, msg) => {
    if (String(text).includes(part)) throw new Error((msg ? msg + ': ' : '') + 'innehåller ' + show(part));
  };
})(typeof self !== 'undefined' ? self : this);
