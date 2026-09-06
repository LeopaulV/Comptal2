import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config Vite pour Tauri 2 : port fixe, pas de HMR sur src-tauri ni data
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 5174,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**', '**/data/**', '**/Documentation/**'],
    },
  },
  build: {
    target: 'chrome110',
    outDir: 'dist',
    sourcemap: false,
  },
});
