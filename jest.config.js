export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@refine-sqlx/core-utils$':
      '<rootDir>/packages/refine-core-utils/src/index.ts',
  },
  testMatch: [
    '<rootDir>/packages/*/src/**/*.test.ts',
    '<rootDir>/packages/*/test/**/*.test.ts',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/test-utils\\.ts$/'],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['text', 'json', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '\\.test\\.ts$',
    'test-utils\\.ts$',
    '\\.d\\.ts$',
    '/examples/',
    '/docs/',
  ],
  testTimeout: 30000,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ESNext',
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
        },
      },
    ],
  },
};
