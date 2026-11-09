import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { defineConfig, type Plugin } from 'vite'

// https://vite.dev/config/
// The app is served from the domain root on Vercel. Set VITE_BASE only for a
// non-root host.
const base = process.env.VITE_BASE || '/'
const root = path.dirname(fileURLToPath(import.meta.url))
const deployToolEnabled = process.env.VERCEL_ENV === 'preview'

function excludeDeployTool(): Plugin {
  return {
    name: 'exclude-deploy-tool',
    enforce: 'pre',
    resolveId(source) {
      if (deployToolEnabled) return null
      const norm = source.replaceAll('\\', '/')
      if (norm.includes('/deploy/DeployTool') || norm.endsWith('deploy/DeployTool')) {
        return '\0deploy-tool-excluded'
      }
      return null
    },
    load(id) {
      if (id !== '\0deploy-tool-excluded') return null
      return 'export function DeployTool() { return null }\n'
    },
  }
}

export default defineConfig({
  base,
  plugins: [
    excludeDeployTool(),
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
    // Boolean literal so production builds drop the deploy-tool chunk.
    __DEPLOY_TOOL_ENABLED__: String(deployToolEnabled),
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
