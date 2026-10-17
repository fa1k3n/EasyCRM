/* Minimal testkörare utan beroenden: test(), eq(), ok(), throwsNot(). Körs i webbläsaren via run.html. */
(function (root) {
  const tests = [];
  let group = '';
  root.describe = (name, fn) => { const prev = group; group = prev ? prev + ' › ' + name : name; fn(); group = prev; };
  root.test = (name, fn) => tests.push({name: group ? group + ' › ' + name : name, fn});

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

  root.runTests = () => {
    const results = {passed: 0, failed: 0, failures: []};
    for (const t of tests) {
      try { t.fn(); results.passed++; }
      catch (e) { results.failed++; results.failures.push({name: t.name, error: e.message}); }
    }
    return results;
  };
})(typeof self !== 'undefined' ? self : this);
