import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', '**/*.test.{ts,tsx}', 'src/index.ts', 'src/types.ts'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 }
    }
  }
});
