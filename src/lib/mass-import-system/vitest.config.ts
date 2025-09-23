import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts', '*.test.ts'],
    exclude: ['node_modules/**'],
    coverage: {
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['test/**', 'src/types/**', 'src/**/*.d.ts'],
    },
    setupFiles: [],
    testTimeout: 10000,
  },
  esbuild: {
    target: 'node18',
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
});
