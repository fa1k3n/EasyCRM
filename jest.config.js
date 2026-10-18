/* jest settings. Three groups of tests:
 * - app: the logic's browser tests (kundregister/tests), loaded by run.jest.js in jsdom exactly like run.html does
 * - ui: the React app's component tests (app/src/**\/*.test.ts(x)), TSX compiled by Babel, in jsdom
 * - tools: the tools' tests in tests/*.test.js, run in Node */
const babel = ['babel-jest', {
  configFile: false,
  babelrc: false,
  presets: [['@babel/preset-env', {targets: {node: 'current'}}], ['@babel/preset-react', {runtime: 'automatic'}], '@babel/preset-typescript']
}];

module.exports = {
  projects: [
    {displayName: 'app', testEnvironment: 'jsdom', testMatch: ['<rootDir>/kundregister/tests/run.jest.js']},
    {
      displayName: 'ui',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/app/src/**/*.test.{ts,tsx}', '<rootDir>/exempel/extensions/**/*.test.{ts,tsx}'],
      setupFiles: ['<rootDir>/app/test/setup.js'],
      transform: {'\\.[jt]sx?$': babel},
      moduleNameMapper: {'\\.css$': '<rootDir>/app/test/style-stub.js', '^virtual:crm-extensions$': '<rootDir>/app/test/no-extensions.js'}
    },
    {displayName: 'tools', testEnvironment: 'node', testMatch: ['<rootDir>/tests/**/*.test.js']}
  ]
};
