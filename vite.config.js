import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    // Prevent "DOCTYPE / HTML returned" errors in dev by proxying API calls
    // to the backend server.
    proxy: {
      '/api': {
        // If you run backend on a different port, set:
        //   VITE_API_PROXY_TARGET=http://localhost:9000
        target: process.env.VITE_API_PROXY_TARGET || 'http://localhost:9000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
