import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Make env variables available
    'process.env': {}
  },
  server: {
    proxy: {
      // Proxy Botpress Chat API requests to avoid CORS
      '/api/botpress': {
        target: 'https://chat.botpress.cloud',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/botpress/, ''),
      },
    },
  },
})
