import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/storybook-static/**',
      'apps/infra/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend services + shared core (Node)
  {
    files: ['apps/backend/**/*.ts', 'libs/core/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Frontends + component library (browser, React)
  {
    files: ['apps/frontend/**/*.{ts,tsx}', 'libs/components/**/*.{ts,tsx}', 'libs/frontend-core/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser },
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Keep the classic hooks rules; the React-Compiler lint extras flag the
      // codebase's standard fetch-on-mount pattern everywhere.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },

  // Vite config files run in Node
  {
    files: ['**/vite.config.ts', '**/vite.config.mts', 'playwright.config.ts', '**/.storybook/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Playwright specs run in Node while driving a browser.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
  },

  // Project-wide rule calibration: the codebase deliberately uses `any` at
  // integration boundaries (express req/res, mongoose docs); don't fight it.
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'preserve-caught-error': 'off',
    },
  },

  // Frontend apps: no `any` in source; still allowed in test files. (Other
  // backend services keep the project-wide `warn` above — they still lean on
  // `any` at integration boundaries like express req/res and mongoose docs.)
  {
    files: ['apps/frontend/**/*.{ts,tsx}'],
    ignores: ['apps/frontend/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Backend services cleared of `any` in source (still allowed in tests).
  // The rest of the backend keeps the project-wide `warn` above.
  {
    files: [
      'apps/backend/auth-service/**/*.ts',
      'apps/backend/group-service/**/*.ts',
      'apps/backend/finance-service/**/*.ts',
      'apps/backend/payment-service/**/*.ts',
    ],
    ignores: ['apps/backend/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  }
);
