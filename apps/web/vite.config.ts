import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom']
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3400',
        configure(proxy) {
          proxy.on('proxyReq', (proxyRequest, request) => {
            const remoteAddress = request.socket.remoteAddress
            if (remoteAddress) proxyRequest.setHeader('x-forwarded-for', remoteAddress)
            else proxyRequest.removeHeader('x-forwarded-for')
          })
        }
      }
    }
  }
})
