import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  server: { port: 3006 },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@tumbaland/components': resolve(__dirname, '../../../libs/components/src')
    }
  },
  build: {
    modulePreload: false,
    target: 'esnext',
    minify: false,
    cssCodeSplit: false
  }
});
