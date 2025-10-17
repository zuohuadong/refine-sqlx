export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^bun:sqlite$': '<rootDir>/test/__mocks__/bun-sqlite.js',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { useESM: true, tsconfig: 'tsconfig.test.json' },
    ],
  },
  testMatch: ['**/test/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/test/integration/'],
  collectCoverageFrom: ['src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
