import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// GitHub Pages serves the app from https://cyptoboy777.github.io/musd-pocket/,
// Vercel serves it from the domain root. VITE_BASE wins if set; otherwise
// Vercel builds (VERCEL=1) get '/', and everything else gets the Pages path.
const base = process.env.VITE_BASE || (process.env.VERCEL ? '/' : '/musd-pocket/')
const root = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base,
  plugins: [
    react(),
    nodePolyfills({
      include: ['buffer', 'process'],
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  define: {
    // OrangeKit / ethereumjs expect Node globals in the browser.
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // OrangeKit deep-imports TS sources; point them at compiled dist so Vite
      // (and Node ESM) resolve cleanly without patching node_modules.
      '@mezo-org/orangekit-smart-account/src': path.resolve(
        root,
        'node_modules/@mezo-org/orangekit-smart-account/dist/src',
      ),
    },
  },
  optimizeDeps: {
    include: ['@mezo-org/orangekit', '@mezo-org/orangekit-smart-account', 'buffer'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
})
