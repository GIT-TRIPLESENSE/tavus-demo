import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Optional dev-only proxy so the browser can talk to the Tavus API
      // without hitting CORS. The app calls `/tavus/v2/...` which is
      // forwarded to `https://tavusapi.com/v2/...`.
      '/tavus': {
        target: 'https://tavusapi.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/tavus/, ''),
      },
    },
  },
})
