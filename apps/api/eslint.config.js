import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

/**
 * Flat-config ESLint setup for the Fastify API.
 *
 * Scope is deliberately minimal: recommended JS + TS rules only. The CI
 * quality gate uses this to catch obvious correctness issues (unused vars,
 * unreachable code, misused `any`) without enforcing stylistic preferences —
 * Prettier would own that if/when added.
 */
export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'drizzle/**',
      'node_modules/**',
      'openapi.json',
      'coverage/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // `any` appears at external-SDK boundaries (Fastify request bodies, AI
      // SDK responses). Keep it visible as a warning rather than an error so
      // CI doesn't gate on what is effectively a typing TODO.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
)
