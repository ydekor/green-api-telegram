import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { proxyHandler } from './server/proxy.mjs'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'green-api-proxy',
      configureServer(server) {
        server.middlewares.use(proxyHandler)
      },
    },
  ],
})
