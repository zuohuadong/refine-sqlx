/**
 * Mock utilities for testing RefineORM components
 * Provides comprehensive mock implementations for database clients and adapters
 */

import { vi, expect } from 'vitest';
import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { DrizzleClient } from '../../types/client.js';
import { BaseDatabaseAdapter } from '../../adapters/base.js';
import type { DatabaseConfig } from '../../types/config.js';

/**
 * Creates a comprehensive mock DrizzleClient for testing
 */
export function createMockDrizzleClient<TSchema extends Record<string, Table>>(
  schema: TSchema,
  mockData: Record<string, any[]> = {}
): DrizzleClient<TSchema> {
  // Create chainable query mock
  const createQueryChain = (tableName: string, data: any[] = []) => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      rightJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      fullJoin: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue(data),
      then: vi.fn().mockImplementation(resolve => resolve(data)),
    };
    return chain;
  };

  // Create insert chain mock
  const createInsertChain = (tableName: string) => ({
    values: vi
      .fn()
      .mockImplementation((values) => {
        // Handle both single and multiple inserts
        const dataArray = Array.isArray(values) ? values : [values];
        const resultData = dataArray.map((data, index) => ({
          id: index + 1,
          ...data,
          ...(mockData[tableName]?.[index] || {}),
        }));
        
        return {
          returning: vi
            .fn()
            .mockReturnValue({
              execute: vi.fn().mockResolvedValue(resultData),
            }),
          onConflictDoNothing: vi
            .fn()
            .mockReturnValue({
              returning: vi
                .fn()
                .mockReturnValue({ execute: vi.fn().mockResolvedValue([]) }),
            }),
          onConflictDoUpdate: vi
            .fn()
            .mockReturnValue({
              returning: vi
                .fn()
                .mockReturnValue({
                  execute: vi.fn().mockResolvedValue(resultData),
                }),
            }),
          execute: vi.fn().mockResolvedValue(resultData),
        };
      }),
  });

  // Create update chain mock
  const createUpdateChain = (tableName: string) => ({
    set: vi
      .fn()
      .mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi
                  .fn()
                  .mockResolvedValue([
                    { id: 1, ...(mockData[tableName]?.[0] || {}) },
                  ]),
              }),
            execute: vi
              .fn()
              .mockResolvedValue([
                { id: 1, ...(mockData[tableName]?.[0] || {}) },
              ]),
          }),
        returning: vi
          .fn()
          .mockReturnValue({
            execute: vi
              .fn()
              .mockResolvedValue([
                { id: 1, ...(mockData[tableName]?.[0] || {}) },
              ]),
          }),
        execute: vi
          .fn()
          .mockResolvedValue([{ id: 1, ...(mockData[tableName]?.[0] || {}) }]),
      }),
  });

  // Create delete chain mock
  const createDeleteChain = (tableName: string) => ({
    where: vi
      .fn()
      .mockReturnValue({
        returning: vi
          .fn()
          .mockReturnValue({
            execute: vi
              .fn()
              .mockResolvedValue([
                { id: 1, ...(mockData[tableName]?.[0] || {}) },
              ]),
          }),
        execute: vi
          .fn()
          .mockResolvedValue([{ id: 1, ...(mockData[tableName]?.[0] || {}) }]),
      }),
    returning: vi
      .fn()
      .mockReturnValue({
        execute: vi
          .fn()
          .mockResolvedValue([{ id: 1, ...(mockData[tableName]?.[0] || {}) }]),
      }),
    execute: vi
      .fn()
      .mockResolvedValue([{ id: 1, ...(mockData[tableName]?.[0] || {}) }]),
  });

  // Create count query mock
  const createCountQuery = (tableName: string) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi
      .fn()
      .mockResolvedValue([{ count: mockData[tableName]?.length || 0 }]),
  });

  // Create aggregate query mock
  const createAggregateQuery = (tableName: string, aggregateValue: number) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([{ value: aggregateValue }]),
  });

  return {
    schema,
    select: vi.fn().mockImplementation(fields => {
      // Determine which table is being queried based on the context
      const tableName = Object.keys(schema)[0]; // Default to first table

      if (fields && typeof fields === 'object') {
        // Check for count queries
        if (fields.count) {
          return createCountQuery(tableName);
        }
        // Check for aggregate queries
        if (fields.sum || fields.avg || fields.min || fields.max) {
          const aggregateValue =
            fields.sum ? 100
            : fields.avg ? 25.5
            : fields.min ? 1
            : 100;
          return createAggregateQuery(tableName, aggregateValue);
        }
      }

      return createQueryChain(tableName, mockData[tableName] || []);
    }),
    insert: vi.fn().mockImplementation(table => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createInsertChain(tableName);
    }),
    update: vi.fn().mockImplementation(table => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createUpdateChain(tableName);
    }),
    delete: vi.fn().mockImplementation(table => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createDeleteChain(tableName);
    }),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn().mockImplementation(async callback => {
      const txClient = createMockDrizzleClient(schema, mockData);
      return await callback(txClient);
    }),
  } as unknown as DrizzleClient<TSchema>;
}

/**
 * Creates a mock database adapter for testing
 */
export class MockDatabaseAdapter<
  TSchema extends Record<string, Table>,
> extends BaseDatabaseAdapter<TSchema> {
  public mockClient: DrizzleClient<TSchema>;
  private mockData: Record<string, any[]>;

  constructor(schema: TSchema, mockData: Record<string, any[]> = {}) {
    super({
      type: 'postgresql',
      connection: 'mock://test',
      schema,
    } as DatabaseConfig<TSchema>);

    this.mockData = mockData;
    this.mockClient = createMockDrizzleClient(schema, mockData);
    this.client = this.mockClient;
    this.isConnected = true;
  }

  async connect(): Promise<void> {
    this.isConnected = true;
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
  }

  async healthCheck(): Promise<boolean> {
    return this.isConnected;
  }

  async executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]> {
    // Mock implementation - return empty array or mock data based on SQL
    if (sql.toLowerCase().includes('select count')) {
      return [{ count: Object.values(this.mockData).flat().length }] as T[];
    }
    return Object.values(this.mockData).flat() as T[];
  }

  async beginTransaction(): Promise<void> {
    // Mock implementation
  }

  async commitTransaction(): Promise<void> {
    // Mock implementation
  }

  async rollbackTransaction(): Promise<void> {
    // Mock implementation
  }

  // Helper methods for testing
  setMockData(tableName: string, data: any[]): void {
    this.mockData[tableName] = data;
  }

  getMockData(tableName: string): any[] {
    return this.mockData[tableName] || [];
  }

  simulateConnectionError(): void {
    this.isConnected = false;
    (this.mockClient.select as any).mockImplementation(() => {
      throw new Error('Connection lost');
    });
  }

  simulateQueryError(): void {
    (this.mockClient.select as any).mockImplementation(() => {
      throw new Error('SQL syntax error');
    });
  }

  resetMocks(): void {
    vi.clearAllMocks();
    this.mockClient = createMockDrizzleClient(
      this.config.schema,
      this.mockData
    );
    this.client = this.mockClient;
    this.isConnected = true;
  }
}

/**
 * Test data generators
 */
export const TestDataGenerators = {
  /**
   * Generate user test data
   */
  users: (count: number = 3) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: 20 + i * 5,
      createdAt: new Date(Date.now() - i * 86400000), // i days ago
    })),

  /**
   * Generate post test data
   */
  posts: (count: number = 5) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      content: `Content for post ${i + 1}`,
      userId: (i % 3) + 1, // Distribute posts among first 3 users
      published: i % 2 === 0,
      createdAt: new Date(Date.now() - i * 3600000), // i hours ago
    })),

  /**
   * Generate comment test data
   */
  comments: (count: number = 10) =>
    Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      content: `Comment ${i + 1}`,
      commentableType: i % 2 === 0 ? 'post' : 'user',
      commentableId: (i % 3) + 1,
      userId: (i % 3) + 1,
      createdAt: new Date(Date.now() - i * 1800000), // i * 30 minutes ago
    })),
};

/**
 * Mock error scenarios for testing error handling
 */
export const MockErrorScenarios = {
  connectionError: () => {
    const error = new Error('ECONNREFUSED: Connection refused');
    error.name = 'ConnectionError';
    return error;
  },

  queryError: () => {
    const error = new Error('syntax error at or near "SELCT"');
    error.name = 'QueryError';
    return error;
  },

  constraintError: () => {
    const error = new Error(
      'duplicate key value violates unique constraint "users_email_unique"'
    );
    error.name = 'ConstraintViolationError';
    return error;
  },

  timeoutError: () => {
    const error = new Error('Query timeout');
    error.name = 'TimeoutError';
    return error;
  },

  validationError: () => {
    const error = new Error('Invalid email format');
    error.name = 'ValidationError';
    return error;
  },
};

/**
 * Type-safe mock data interface
 */
export type MockDataSet<TSchema extends Record<string, Table>> = {
  [K in keyof TSchema]: InferSelectModel<TSchema[K]>[];
};

/**
 * Create type-safe mock data for a schema
 */
export function createMockDataSet<TSchema extends Record<string, Table>>(
  schema: TSchema,
  generators: Partial<{
    [K in keyof TSchema]: () => InferSelectModel<TSchema[K]>[];
  }>
): MockDataSet<TSchema> {
  const mockData = {} as MockDataSet<TSchema>;

  for (const tableName in schema) {
    const generator = generators[tableName];
    if (generator) {
      mockData[tableName] = generator();
    } else {
      // Default empty array
      mockData[tableName] = [];
    }
  }

  return mockData;
}

/**
 * Assertion helpers for testing
 */
export const TestAssertions = {
  /**
   * Assert that a value is a valid database record
   */
  isValidRecord: (record: any, requiredFields: string[] = ['id']) => {
    expect(record).toBeDefined();
    expect(typeof record).toBe('object');
    requiredFields.forEach(field => {
      expect(record).toHaveProperty(field);
    });
  },

  /**
   * Assert that an array contains valid database records
   */
  areValidRecords: (records: any[], requiredFields: string[] = ['id']) => {
    expect(Array.isArray(records)).toBe(true);
    records.forEach(record => {
      TestAssertions.isValidRecord(record, requiredFields);
    });
  },

  /**
   * Assert that a response matches the expected Refine response format
   */
  isValidRefineResponse: (response: any, expectedDataLength?: number) => {
    expect(response).toBeDefined();
    expect(response).toHaveProperty('data');

    if (expectedDataLength !== undefined) {
      if (Array.isArray(response.data)) {
        expect(response.data).toHaveLength(expectedDataLength);
      }
    }
  },

  /**
   * Assert that a list response includes total count
   */
  isValidListResponse: (response: any, expectedTotal?: number) => {
    TestAssertions.isValidRefineResponse(response);
    expect(response).toHaveProperty('total');
    expect(typeof response.total).toBe('number');

    if (expectedTotal !== undefined) {
      expect(response.total).toBe(expectedTotal);
    }
  },
};
