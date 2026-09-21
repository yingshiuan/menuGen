import { fileURLToPath, URL } from 'node:url'
import { execFile } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import tailwindcss from '@tailwindcss/vite'

// The PDF backend has no Vite: it styles pages with public/css/tailwind.css, a prebuilt
// copy of the app's CSS. Rebuild that copy whenever the app's sources change -- with the
// same command as `npm run build:css`, so CI's check agrees -- so a PDF never lags behind
// the preview. The file is only rewritten when its contents change.
function pdfStylesheet(): Plugin {
  const root = fileURLToPath(new URL('.', import.meta.url))
  const target = join(root, 'public/css/tailwind.css')
  let timer: ReturnType<typeof setTimeout> | undefined

  const build = () =>
    new Promise<void>((resolve) => {
      const scratch = join(tmpdir(), `pdf-stylesheet-${process.pid}.css`)
      execFile(
        join(root, 'node_modules/.bin/tailwindcss'),
        ['-i', 'src/asset/styles/style.css', '-o', scratch, '--minify'],
        { cwd: root },
        (error, _stdout, stderr) => {
          if (error) {
            console.warn(`[pdf-stylesheet] ${stderr || error.message}`)
          } else {
            const css = readFileSync(scratch)
            if (!existsSync(target) || !css.equals(readFileSync(target))) writeFileSync(target, css)
          }
          resolve()
        },
      )
    })

  return {
    name: 'pdf-stylesheet',
    // Not under Vitest: a test run must not rewrite a tracked file
    apply: () => !process.env.VITEST,
    buildStart: build,
    configureServer(server) {
      // Vite's own watcher, which also polls inside the Docker dev container
      server.watcher.on('all', (_event, file) => {
        if (!/[\\/]src[\\/].*\.(vue|ts|css)$/.test(file)) return
        clearTimeout(timer)
        timer = setTimeout(build, 300)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueDevTools(), tailwindcss(), pdfStylesheet()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
    // Docker Desktop on macOS doesn't pass file-change events into bind mounts, so the
    // dev container polls instead (set in docker-compose.dev.yml)
    watch: { usePolling: process.env.CHOKIDAR_USEPOLLING === 'true' },
    proxy: {
      // Forward all /api requests to your backend
      '/api': {
        target: 'http://backend-dev:3000',
        // target: 'http://192.168.1.100:3000',
        // target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
