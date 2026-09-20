import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import {
  TUMBALAND_FEDERATION_SHARED,
  TUMBALAND_REMOTE_ENTRY,
  TUMBALAND_REMOTE_MODULE
} from '@tumbaland/frontend-core/federation';
import { resolve } from 'path';
import { cpus } from 'os';

/**
 * Vitest defaults to one worker per core, and each one carries its own jsdom —
 * roughly 350 MB with React and MUI loaded. On a 20-core machine that is around
 * 7.5 GB all at once, which is survivable from a bare shell but not alongside
 * an editor, its TypeScript server and a language server.
 *
 * A quarter of the cores keeps the suite comfortably parallel while leaving the
 * machine usable. Raise it on a dedicated CI box if the wall clock matters more
 * than the headroom.
 */
const TEST_WORKERS = Math.max(2, Math.floor(cpus().length / 4));

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Besides running standalone, finance-front is a module-federation remote:
    // shell-front loads `./App` from this origin's remoteEntry.js. Vitest has
    // no use for the federation build, so it is left out there.
    ...(process.env.VITEST
      ? []
      : [
          federation({
            name: 'finance',
            filename: TUMBALAND_REMOTE_ENTRY,
            exposes: { [TUMBALAND_REMOTE_MODULE]: './src/federation/RemoteApp.tsx' },
            shared: TUMBALAND_FEDERATION_SHARED,
            dts: false
          })
        ])
  ],
  server: {
    port: 3003,
    // Absolute asset URLs in dev, so the shell's page fetches them from here.
    origin: 'http://localhost:3003'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      ...(mode === 'development' && {
        '@tumbaland/components': resolve(__dirname, '../../../libs/components/src')
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
    maxWorkers: TEST_WORKERS,
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      exclude: ['src/main.tsx', 'src/vite-env.d.ts', 'src/test/**', '**/*.test.{ts,tsx}'],
      thresholds: { statements: 90, branches: 80, functions: 90, lines: 90 }
    }
  }
}));
