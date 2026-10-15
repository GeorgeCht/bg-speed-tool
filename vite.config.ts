import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  base: './', // relative paths so it works under /bg-speed-tool/ on GitHub Pages
  plugins: [react()],
})
