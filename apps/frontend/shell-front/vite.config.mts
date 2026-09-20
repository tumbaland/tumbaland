import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import { TUMBALAND_FEDERATION_SHARED } from '@tumbaland/frontend-core/federation';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // The module-federation host. No remotes are listed here: where each module
    // lives is deployment config, so their URLs come from config.json at runtime
    // and are registered in `src/remotes.ts`. Vitest has no use for the
    // federation build, so it is left out there.
    ...(process.env.VITEST
      ? []
      : [federation({ name: 'shell', remotes: {}, shared: TUMBALAND_FEDERATION_SHARED, dts: false })])
  ],
  server: {
    port: 3000
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      ...(mode === 'development' && {
        '@tumbaland/frontend-core': resolve(__dirname, '../../../libs/frontend-core/src')
      })
    }
  },
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false,
    // Vite 8 transforms JSX via Oxc, not esbuild, so `esbuild.drop` is a no-op here (Oxc's
    // transform step has no equivalent option and @vitejs/plugin-react needs Oxc for Fast
    // Refresh, so it can't be disabled). Stripping console.* in prod builds only works through
    // the Oxc-based minifier's compress option, applied here without touching `minify: false`.
    rollupOptions: {
      output: {
        minify: mode === 'production' ? { compress: { dropConsole: true }, mangle: false, codegen: false } : false
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', '**/*.test.{ts,tsx}'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 }
    }
  }
}));
