/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  clearMocks: true,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['jest', 'node'] } }]
  },
  coverageProvider: 'v8',
  // Barrels are excluded, not just the root one: a file of `export { x } from
  // './y'` has no logic to test, but Jest counts every re-exported function as
  // an uncovered one — which is what held global function coverage at ~78%
  // while every module underneath was thoroughly tested.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/index.ts',
    '!src/**/index.ts',
    '!src/types/**'
  ],
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: { global: { statements: 90, branches: 80, functions: 90, lines: 90 } }
};
