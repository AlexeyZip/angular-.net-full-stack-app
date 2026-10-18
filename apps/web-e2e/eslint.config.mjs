import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Playwright detects fixture dependencies from a destructured first parameter, so `({}, use)` is required.
      'no-empty-pattern': 'off',
    },
  },
];
