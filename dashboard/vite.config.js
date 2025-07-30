import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from "url";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 5173,
    open: true,
    proxy: {
      // API-Anfragen zum Backend-Server
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      },
      // Geteilte Datei-Links - Wichtig: GENAUER Pfad mit '/' am Ende, damit nicht '/files' abgefangen wird
      '/file/': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
}); 