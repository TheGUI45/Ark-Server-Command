import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true
  },
  server: {
    port: Number(process.env.DEV_PORT || process.env.VITE_PORT || 5183),
    strictPort: true
  }
});
