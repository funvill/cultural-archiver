import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import vueEslintParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      // Many legacy files use `any` and temporary unused vars in this pre-release
      // phase. Treat these as warnings so lint can be used as guidance rather
      // than a hard blocker across the whole repository.
  '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'warn',

      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 2023,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // NOTE: test files are large and use many helpers/mocks. We prefer to skip
  // linting test folders to keep the linter focused on production code.
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueEslintParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 2023,
        sourceType: 'module',
        extraFileExtensions: ['.vue'],
      },
    },
    plugins: {
      vue: vuePlugin,
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/component-tags-order': [
        'error',
        {
          order: ['script', 'template', 'style'],
        },
      ],
      'vue/component-name-in-template-casing': ['error', 'PascalCase'],
      'vue/custom-event-name-casing': ['error', 'camelCase'],
    },
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      '**/dist/**',
      '**/__tests__/**',
      '**/test/**',
      '**/*.test.ts',
      '**/*.spec.ts',
      'src/frontend/dist/**',
      'src/workers/dist/**',
      'src/workers/.wrangler/**',
      '.wrangler/**',
      '**/.wrangler/**',
      '**/tmp/**',
      '**/bundle-*/**',
      'src/lib/**/templates/**',
      '*.d.ts',
    ],
  },
  // Temporary override: these legacy mass-import and worker modules contain
  // many uses of `any`. Suppress the `no-explicit-any` rule here while we
  // perform a focused typing sprint to avoid overwhelming the linter output.
  {
    files: ['src/lib/mass-import-system/**', 'src/workers/**', 'src/shared/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  // Allow sanitized HTML in specific static content views (we sanitize before assigning)
  {
    files: [
      'src/frontend/src/views/ArtistDetailView.vue',
      'src/frontend/src/views/ArtworkDetailView.vue',
      'src/frontend/src/views/PrivacyView.vue',
      'src/frontend/src/views/TermsView.vue',
    ],
    rules: {
      'vue/no-v-html': 'off',
    },
  },
];
