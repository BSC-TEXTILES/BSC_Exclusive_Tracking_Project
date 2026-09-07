import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function removeCrossoriginFromCss(): Plugin {
  return {
    name: 'remove-crossorigin-css',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(
        /(<link\s+rel="stylesheet"[^>]*?)\s+crossorigin/g,
        '$1'
      )
    }
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), removeCrossoriginFromCss()],
  server: {
    port: 5173,
    host: true,
    cors: true,
    fs: {
      strict: false,
    },
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          maps: ['leaflet'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
