import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Only the sources. A stale dist would otherwise be collected as a second
    // copy of every suite.
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/testUtils.ts', 'src/index.ts', 'src/config.ts', 'src/canvas.ts'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 }
    }
  }
});
