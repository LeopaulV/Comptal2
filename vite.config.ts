import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'path';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';
  
  return {
    base: './', // Important pour Electron en production - permet aux chemins relatifs de fonctionner avec loadFile()
    plugins: [
      react(),
      electron([
        {
          entry: 'src/main/main.ts',
          onstart(options) {
            // Notifier Electron que le serveur Vite est prêt
            options.startup();
          },
          vite: {
            build: {
              outDir: 'dist-electron',
              rollupOptions: {
                external: ['electron']
              }
            }
          }
        },
        {
          entry: 'src/main/preload.ts',
          onstart(options) {
            // Recharger le preload quand il change
            options.reload();
          },
          vite: {
            build: {
              outDir: 'dist-electron'
            }
          }
        }
      ]),
      renderer()
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/renderer/components'),
        '@pages': path.resolve(__dirname, './src/renderer/pages'),
        '@services': path.resolve(__dirname, './src/renderer/services'),
        '@types': path.resolve(__dirname, './src/renderer/types'),
        '@utils': path.resolve(__dirname, './src/renderer/utils')
      }
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true
    },
    server: {
      port: 5173
    }
  };
});

