/* jest settings. Two groups of tests:
 * - app: the app's browser tests (kundregister/tests), loaded by run.jest.js in jsdom exactly like run.html does
 * - tools: the tools' tests in tests/*.test.js, run in Node */
module.exports = {
  projects: [
    {displayName: 'app', testEnvironment: 'jsdom', testMatch: ['<rootDir>/kundregister/tests/run.jest.js']},
    {displayName: 'tools', testEnvironment: 'node', testMatch: ['<rootDir>/tests/**/*.test.js']}
  ]
};
