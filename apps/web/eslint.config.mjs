import baseConfig from '../../eslint.config.mjs';

const stateImplementations = {
  patterns: [
    {
      group: ['@shop/state/signals', '@shop/state/ngrx'],
      message: 'Inject the contracts from @shop/state/contracts. Only src/app/state/*.providers*.ts may choose an implementation.',
    },
  ],
};

export default [
  ...baseConfig,
  {
    files: ['src/**/*.ts'],
    ignores: ['src/app/state/**'],
    rules: {
      'no-restricted-imports': ['error', stateImplementations],
    },
  },
];
