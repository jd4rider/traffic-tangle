import { defineConfig } from 'vite'

export default defineConfig({
  // Relative asset paths keep the build portable across GitHub Pages project
  // paths, a future custom domain, and the arcade iframe.
  base: './',
  server: { port: 5177 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
})
