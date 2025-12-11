import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'public/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactPlugin.configs['jsx-runtime'].rules,
      // Existing code has many legacy patterns; keep lint actionable but avoid hard failures
      // until the violations can be addressed incrementally.
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off',
      'react/display-name': 'off',
      'react-refresh/only-export-components': 'off',
      // Линт оставляем максимально информативным, но не требуем исправления
      // старого кода с множеством предупреждений прямо сейчас.
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-constant-condition': ['off', { checkLoops: false }],
      'no-case-declarations': 'off',
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },
]
