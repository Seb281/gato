import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'

/**
 * Flat-config ESLint setup for the WXT + React extension.
 *
 * Ignores generated WXT output (`.output`, `.wxt`) and applies the usual
 * recommended rule sets: @eslint/js, typescript-eslint, react, react-hooks.
 * The React new-JSX-transform is assumed, so `react-in-jsx-scope` is off.
 */
export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'dist/**',
      'node_modules/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,jsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.webextensions,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      // v7 of eslint-plugin-react-hooks flags the common "setIsLoading(true)
      // before an async dispatch" pattern. The code works fine at runtime —
      // downgrade to warn so the signal is visible without gating CI.
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
