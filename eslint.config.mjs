import nx from '@nx/eslint-plugin';
import angular from 'angular-eslint';

/**
 * Workspace-wide lint rules for the TypeScript/Angular part of the monorepo.
 * The .NET backend (services/api) is analysed by the .NET SDK analyzers instead (TreatWarningsAsErrors).
 */
export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/coverage',
      '**/.angular',
      '**/.nx',
      '**/playwright-report',
      '**/test-results',
      'services/**',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs'],
    rules: {
      // Architectural boundaries, enforced by tags in each project.json:
      // the two state implementations can never import each other, UI never imports state or HTTP code.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            { sourceTag: 'type:app', onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:state-contracts', 'type:state-impl'] },
            { sourceTag: 'type:e2e', onlyDependOnLibsWithTags: [] },
            // A microfrontend is built and deployed on its own: it shares only a DOM contract (element name,
            // attributes, events) and CSS custom properties with the host, never code.
            { sourceTag: 'type:remote', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:state-impl', onlyDependOnLibsWithTags: ['type:state-contracts', 'type:data-access'] },
            { sourceTag: 'type:state-contracts', onlyDependOnLibsWithTags: ['type:data-access'] },
            { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: [] },
            { sourceTag: 'type:ui', onlyDependOnLibsWithTags: [] },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  // Angular rules for TypeScript files; inline templates are extracted and linted as HTML below.
  ...nx.configs['flat/angular'].map((config) => ({ ...config, files: ['**/*.ts'] })),
  ...nx.configs['flat/angular-template'],
  ...angular.configs.templateAccessibility.map((config) => ({ ...config, files: ['**/*.html'] })),
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/component-selector': ['error', { type: 'element', prefix: 'shop', style: 'kebab-case' }],
      '@angular-eslint/directive-selector': ['error', { type: 'attribute', prefix: 'shop', style: 'camelCase' }],
      '@angular-eslint/prefer-on-push-component-change-detection': 'error',
      '@angular-eslint/prefer-signals': 'error',
    },
  },
  {
    files: ['**/*.html'],
    rules: {
      '@angular-eslint/template/prefer-control-flow': 'error',
      '@angular-eslint/template/prefer-self-closing-tags': 'error',
    },
  },
];
