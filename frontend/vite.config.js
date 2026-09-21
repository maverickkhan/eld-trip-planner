import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // MUI + React land in one ~650 kB vendor chunk (~200 kB gzip); Leaflet is lazy-loaded.
    chunkSizeWarningLimit: 700,
  },
  server: {
    // In development the API is proxied so the frontend can call `/api/...`
    // without CORS.  In production VITE_API_BASE_URL points at the hosted API.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API_PROXY || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
