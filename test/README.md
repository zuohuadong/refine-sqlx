# Testing Structure

This project uses a structured testing approach with separate unit and integration tests.

## Test Organization

### Unit Tests

- **Location**: `test/*.test.ts`
- **Purpose**: Test individual components in isolation with mocks
- **Command**: `npm test` or `bun test`
- **Files**:
  - `adapters.test.ts` - Mock-based adapter tests
  - `data-provider.test.ts` - Data provider logic tests
  - `utils.test.ts` - Utility function tests
  - `detect-sqlite.test.ts` - Runtime detection tests

### Integration Tests

- **Location**: `test/integration/*.test.ts`
- **Purpose**: Test end-to-end functionality with real databases
- **Base Suite**: `test/integration.ts` - Generic test suite
- **Platform Tests**:
  - `bun.test.ts` - Bun SQLite integration tests
  - `node.test.ts` - Node.js v24+ SQLite integration tests

## Test Commands

```bash
# Run unit tests only (default)
npm test
bun test

# Run all integration tests
npm run test:integration-bun
npm run test:integration-node
npm run test:integration-better-sqlite3

# Run specific platform integration tests
bun run test:integration-bun
bun test test/integration/bun.test.ts

npm run test:integration-node
node --experimental-vm-modules node_modules/jest/bin/jest.js test/integration/node.test.ts

npm run test:integration-better-sqlite3
node --experimental-vm-modules node_modules/jest/bin/jest.js test/integration/better-sqlite3.test.ts
```

## CI/CD Integration

The GitHub workflow (`.github/workflows/ci.yml`) runs:

1. **Unit Tests**: Jest for Node.js, Bun test for Bun runtime
2. **Bun Integration**: Real Bun SQLite database tests
3. **Node.js Integration**: Node.js v24+ SQLite tests and better-sqlite3 tests
4. **Format Check**: Code formatting validation

## Platform-Specific Notes

### Bun Runtime

- Primary development and testing runtime
- Native SQLite support via `bun:sqlite`
- All tests run in Bun environment

### Node.js Runtime

- Integration tests require Node.js v24+ for `node:sqlite` support
- Tests automatically skip on older versions or when running in Bun
- Unit tests work on Node.js 18+

### Test Database

- All integration tests use in-memory SQLite (`:memory:`)
- Fresh database instance for each test
- No persistent data between tests
