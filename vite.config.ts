import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core libraries
          'react-vendor': ['react', 'react-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],

          // Chart library (solo Dashboard)
          'chart-vendor': ['recharts'],

          // PDF libraries (solo cuando se imprime)
          'pdf-vendor': ['@react-pdf/renderer', 'qrcode.react'],

          // Icons (usado en toda la app)
          'icons-vendor': ['lucide-react'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
