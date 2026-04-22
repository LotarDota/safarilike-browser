import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        chrome: resolve(__dirname, 'src/renderer/chrome.html'),
        newtab: resolve(__dirname, 'src/renderer/newtab.html'),
        settings: resolve(__dirname, 'src/renderer/settings.html'),
        reader: resolve(__dirname, 'src/renderer/reader.html'),
      },
    },
  },
  server: {
    port: 5179,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
});
