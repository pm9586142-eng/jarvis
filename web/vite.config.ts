import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const devApiPort = process.env.DEV_API_PORT || '3001';
const basePath = process.env.VITE_BASE_PATH || '/';
const devPort = Number(process.env.VITE_PORT || process.env.DEFAULT_APP_PORT) || 3000;
const disableHmr = process.env.DISABLE_HMR === 'true';

export default defineConfig({
  base: basePath,
  plugins: [react(), tailwindcss()],
  server: {
    port: devPort,
    host: '0.0.0.0',
    strictPort: false,
    hmr: disableHmr ? false : undefined,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${devApiPort}`,
        changeOrigin: true,
      },
      '/health': {
        target: `http://127.0.0.1:${devApiPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PREVIEW_PORT || process.env.DEFAULT_APP_PORT) || 3000,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react_vendor: ['react', 'react-dom'],
          icons: ['lucide-react'],
          three_vendor: ['three'],
        },
      },
    },
  },
});
