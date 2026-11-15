import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const server = `http://localhost:${process.env.MONTAGE_PORT || 38420}`;
const proxy = { target: server, changeOrigin: true };

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': proxy,
      '/cache': proxy,
      '/files': proxy,
      '/fonts': proxy,
      '/ws': { target: server.replace('http', 'ws'), ws: true, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
});
