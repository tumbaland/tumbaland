import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react()],
    server: {
      port: 3004
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        ...(mode === 'development' && {
          '@tumbaland/components': resolve(__dirname, '../../../libs/components/src')
        })
      }
    },
    define: {
      'process.env': env // Expose .env variables to the app
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
      setupFiles: ['./src/test/setup.ts']
    }
  };
});
