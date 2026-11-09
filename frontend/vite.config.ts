import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// The app is served from the domain root on Vercel. Set VITE_BASE only for a
// non-root host.
const base = process.env.VITE_BASE || '/'
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
      '@facts': path.resolve(root, '../facts.json'),
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
