export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/src/__tests__/integration/',
    '/test-utils\\.ts$/',
  ],
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
  coverageReporters: ['text', 'json', 'html'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    'src/__tests__/**/*.test.ts',
    'test-utils\\.ts$',
    'src/**/*.d.ts',
    'src/client.d.ts',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
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
