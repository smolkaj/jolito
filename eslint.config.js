import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'coverage/',
      'dist/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
    ],
  },
  {
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                '**/application/**',
                '**/infrastructure/**',
                '**/ui/**',
                '**/jolito',
                '**/jolito.tsx',
                '**/main',
                '**/main.tsx',
              ],
              message:
                'Domain code must remain independent of UI, application orchestration, and infrastructure.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/*',
                '**/infrastructure/**',
                '**/ui/**',
                '**/jolito',
                '**/jolito.tsx',
                '**/main',
                '**/main.tsx',
              ],
              message:
                'Application code may depend on domain types and declared ports, not UI or concrete infrastructure.',
            },
          ],
        },
      ],
    },
  },
)
