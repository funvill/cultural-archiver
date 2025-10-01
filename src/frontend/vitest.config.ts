/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/tests/e2e/**', // Exclude Playwright E2E tests
      '**/tests/playwright/**', // Exclude standalone Playwright tests
      'tests/**', // Exclude top-level Playwright/test suites under tests/
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
