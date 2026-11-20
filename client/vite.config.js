import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: mode === "mobile" ? {
    proxy: { "/api": "http://127.0.0.1:5000" },
  } : undefined,
}))
