import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages serves the app from https://cyptoboy777.github.io/musd-pocket/,
// Vercel serves it from the domain root. VITE_BASE wins if set; otherwise
// Vercel builds (VERCEL=1) get '/', and everything else gets the Pages path.
const base = process.env.VITE_BASE || (process.env.VERCEL ? '/' : '/musd-pocket/')

export default defineConfig({
  base,
  plugins: [react()],
})
