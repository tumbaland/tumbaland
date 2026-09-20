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
      '**/*.mjs'
    ]
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend services + shared core (Node)
  {
    files: ['apps/backend/**/*.ts', 'libs/backend-core/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Frontends + component library (browser, React)
  {
    files: ['apps/frontend/**/*.{ts,tsx}', 'libs/frontend-core/**/*.ts'],
    languageOptions: {
      globals: { ...globals.browser }
    },
    plugins: {
      'react-hooks': reactHooks
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Keep the classic hooks rules; the React-Compiler lint extras flag the
      // codebase's standard fetch-on-mount pattern everywhere.
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/preserve-manual-memoization': 'off'
    }
  },

  // Vite config files run in Node
  {
    files: ['**/vite.config.ts', '**/vite.config.mts', 'playwright.config.ts', '**/.storybook/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Playwright specs run in Node while driving a browser.
  {
    files: ['e2e/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node }
    }
  },

  // Default calibration, mainly a safety net for tooling/config files not
  // covered by a workspace (vite/playwright/storybook configs, e2e specs):
  // every real source tree — backend services + libs/backend-core, frontend
  // apps + libs/frontend-core — promotes this to `error`
  // via the overrides below (tests keep `any` allowed everywhere).
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }
      ],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
      'preserve-caught-error': 'off'
    }
  },

  // Frontend apps + the shared frontend libs: no `any` in source (still
  // allowed in tests). libs/frontend-core is now
  // verified clean of non-test `any`, closing the last gap from the
  // any-removal campaign — every workspace in the repo enforces this at
  // `error` except test files (only tooling/config files outside any
  // workspace's src, e.g. vite/playwright/storybook configs, still fall
  // back to the project-wide `warn` above).
  {
    files: ['apps/frontend/**/*.{ts,tsx}', 'libs/frontend-core/**/*.{ts,tsx}'],
    ignores: ['apps/frontend/**/*.test.{ts,tsx}', 'libs/frontend-core/**/*.test.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  },

  // All backend services AND the shared backend-core lib cleared of `any` in
  // source (still allowed in tests). backend-core's observability layer
  // (tracing/metrics/error handling) is now typed against the OpenTelemetry
  // and Express APIs instead of leaning on `any` at those boundaries.
  {
    files: ['apps/backend/**/*.ts', 'libs/backend-core/**/*.ts'],
    ignores: ['apps/backend/**/*.test.ts', 'libs/backend-core/**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error'
    }
  }
);
