import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// base is set for GitHub Pages: https://cyptoboy777.github.io/musd-pocket/
export default defineConfig({
  base: process.env.VITE_BASE ?? '/musd-pocket/',
  plugins: [react()],
})
