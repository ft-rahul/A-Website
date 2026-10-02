import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API runs separately (../monklogy-backend, port 4000). Proxying /api keeps
// every request same-origin, so the refresh cookie stays SameSite=Strict.
const API_TARGET = process.env.VITE_API_PROXY || 'http://localhost:4000';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } }
  },
  preview: {
    port: 3000,
    proxy: { '/api': { target: API_TARGET, changeOrigin: false } }
  }
});
