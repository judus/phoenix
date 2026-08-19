import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:3410', xfwd: true }
    }
  }
})
