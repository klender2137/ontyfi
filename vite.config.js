import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'public',
  envDir: '..', // Load .env files from parent directory (project root)
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'esnext', // <--- ADD THIS LINE
  },
  esbuild: {
    supported: {
      'top-level-await': true // <--- AND THIS BLOCK
    },
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})