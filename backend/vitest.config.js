import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.spec.js'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      // skipFull has to reach the text reporter itself. Left on, a module at
      // 100% is omitted from the table entirely, which reads as missing rather
      // than finished -- the opposite of what a coverage report is for.
      reporter: [['text', { skipFull: false }], 'html'],
      // Vitest only reports files a test imports unless `include` is set, which
      // hides every untested file behind a flattering average. Report all of the
      // source tree, the same way frontend/vitest.config.ts does.
      include: [
        'app/**/*.js',
        'infrastructure/**/*.js',
        'routes/**/*.js',
        'services/**/*.js',
        'server.js',
      ],
      // Listing server.js above does not run it -- the v8 provider reports a
      // never-imported file from static analysis, so it scores an honest 0%
      // without anyone binding a port.
      exclude: [
        '**/__tests__/**',
        // untracked scratch routes, not wired into the server
        'routes/oldpdf.js',
        'routes/uploadRoute.js',
      ],
    },
  },
})
