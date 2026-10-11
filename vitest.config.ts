import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: [
      './tests/setup-catalogue.ts',
      ...(process.env.PHOENIX_TEST_SQLITE_PROFILE === '1' ? ['./tests/support/sqlite-profile.ts'] : [])
    ]
  }
})
