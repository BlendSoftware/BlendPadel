import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'BlendPadel',
        short_name: 'BlendPadel',
        description: 'Encontrá partidos de pádel cerca tuyo',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^http:\/\/localhost\/api\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/players': 'http://localhost:8080',
      '/matches': 'http://localhost:8080',
      '/regions': 'http://localhost:8080',
      '/onboarding': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/rankings': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
      '/matchmaking': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
      '/radar': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
      '/venues': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
      '/partnerships': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
      '/feed': { target: 'http://localhost:8080', bypass: (req) => { if (req.headers.accept?.includes('text/html')) return req.url } },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
