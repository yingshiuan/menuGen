import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider: 'v8',
        // Vitest only reports files a test imports unless `include` is set, which
        // hides every untested file behind a flattering average. Report all of src/.
        include: ['src/**/*.{ts,vue}'],
        exclude: [
          'src/**/__tests__/**',
          'src/**/*.d.ts', // type declarations have no runtime code
          // untracked scratch copies, not part of the app
          'src/components/archive/**',
          'src/**/* copy.vue',
        ],
      },
    },
  }),
)
