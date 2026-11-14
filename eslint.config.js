import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const CORE_PURITY_MESSAGE =
  'src/core ve src/sim saf TypeScript olmalı: DOM/React/depolama yok (PROJECT_MEMORY §3.5).'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // Çekirdek saflığı: DOM global'leri, React/Dexie import'u ve Math.random yasak (PROJECT_MEMORY §3.5, §10).
    files: ['src/core/**/*.{ts,tsx}', 'src/sim/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: CORE_PURITY_MESSAGE },
        { name: 'document', message: CORE_PURITY_MESSAGE },
        { name: 'localStorage', message: CORE_PURITY_MESSAGE },
        { name: 'sessionStorage', message: CORE_PURITY_MESSAGE },
        { name: 'indexedDB', message: CORE_PURITY_MESSAGE },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'react', message: CORE_PURITY_MESSAGE },
            { name: 'react-dom', message: CORE_PURITY_MESSAGE },
            { name: 'dexie', message: CORE_PURITY_MESSAGE },
          ],
          patterns: [{ group: ['react/*', 'react-dom/*'], message: CORE_PURITY_MESSAGE }],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Rastgelelik yalnızca src/sim/rng.ts üzerinden (PROJECT_MEMORY §10).',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.ts', 'vite.config.ts', 'eslint.config.js', 'tests/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
