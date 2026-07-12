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
    files: ['**/vite.config.ts', '**/vite.config.mts', '**/.storybook/**/*.ts'],
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
  }
);
