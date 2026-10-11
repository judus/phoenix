import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Hosted Windows runners contend on durable SQLite writes across test files.
    // Keep real disk fixtures and normal timeouts; only CI file parallelism is bounded.
    ...(process.env.CI === 'true' && process.platform === 'win32' ? { maxWorkers: 1 } : {}),
    setupFiles: [
      './tests/setup-catalogue.ts',
      './tests/setup-animation-frame.ts',
      ...(process.env.PHOENIX_TEST_SQLITE_PROFILE === '1' ? ['./tests/support/sqlite-profile.ts'] : [])
    ]
  }
})
