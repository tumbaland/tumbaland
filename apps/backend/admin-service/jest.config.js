/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Test tokens carry no session and there is no group-service (see backend-core's testing.js).
  setupFiles: ['@tumbaland/backend-core/testing'],
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  clearMocks: true,
  // Aggregations are the whole of this service, so its tests run against a real MongoDB.
  testTimeout: 120000,
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { types: ['jest', 'node'] } }]
  },
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts', '!src/index.ts', '!src/types/**', '!src/test/**'],
  coverageReporters: ['text', 'json-summary'],
  coverageThreshold: { global: { statements: 90, branches: 80, functions: 90, lines: 90 } }
};
