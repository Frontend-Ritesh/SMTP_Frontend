import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 7086,
    host: true,
    allowedHosts: ['mail.acetechnologys.com']
  },
  preview: {
    port: 7086,
    host: true,
    allowedHosts: ['mail.acetechnologys.com']
  }
})
