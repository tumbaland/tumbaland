import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { federation } from '@module-federation/vite';
import {
  TUMBALAND_FEDERATION_SHARED,
  TUMBALAND_REMOTE_ENTRY,
  TUMBALAND_REMOTE_MODULE
} from '@tumbaland/frontend-core/federation';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    // Besides running standalone, chat-front is a module-federation remote:
    // shell-front loads `./App` from this origin's remoteEntry.js. Vitest has
    // no use for the federation build, so it is left out there.
    ...(process.env.VITEST
      ? []
      : [
          federation({
            name: 'chat',
            filename: TUMBALAND_REMOTE_ENTRY,
            exposes: { [TUMBALAND_REMOTE_MODULE]: './src/federation/RemoteApp.tsx' },
            shared: TUMBALAND_FEDERATION_SHARED,
            dts: false
          })
        ])
  ],
  server: { port: 3008,
    // Absolute asset URLs in dev, so the shell's page fetches them from here.
    origin: 'http://localhost:3008' },
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
