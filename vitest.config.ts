import { defineConfig } from 'vitest/config'
import { searchForWorkspaceRoot } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [searchForWorkspaceRoot(process.cwd()), '..'],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/application/**/*.ts'],
      reporter: ['text', 'html', 'json-summary'],
      thresholds: {
        branches: 95,
        functions: 95,
        lines: 95,
        statements: 95,
      },
    },
  },
})
