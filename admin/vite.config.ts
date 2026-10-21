import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: '/admin/',
  build: {
    outDir: path.resolve(__dirname, '../server/public/admin'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    allowedHosts: ['vibetower.app', '.vibetower.app'],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    allowedHosts: ['vibetower.app', '.vibetower.app'],
  },
});
