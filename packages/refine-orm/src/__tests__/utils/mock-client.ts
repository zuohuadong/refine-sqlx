/**
 * Mock utilities for testing RefineORM components
 * Provides comprehensive mock implementations for database clients and adapters
 */

import { vi, expect } from 'vitest';
import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { DrizzleClient } from '../../types/client';
import { BaseDatabaseAdapter } from '../../adapters/base';
import type { DatabaseConfig } from '../../types/config';
import { ValidationError, ConnectionError, QueryError } from '../../types/errors';

/**
 * Creates a comprehensive mock DrizzleClient for testing
 */
export function createMockDrizzleClient<TSchema extends Record<string, Table>>(
  schema: TSchema,
  mockData: Record<string, any[]> = {}
): DrizzleClient<TSchema> {
  // Registry to track created records by table
  const createdRecords: Record<string, any[]> = {};
  
  // Create chainable query mock
  const createQueryChain = (tableName: string, data: any[] = []) => {
    let limitValue: number | undefined;
    let offsetValue: number | undefined;
    let whereConditions: any[] = [];
    
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation((condition: any) => {
        whereConditions.push(condition);
        return chain;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation((value: number) => {
        limitValue = value;
        return chain;
      }),
      offset: vi.fn().mockImplementation((value: number) => {
        offsetValue = value;
        return chain;
      }),
      groupBy: vi.fn().mockReturnThis(),
      having: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      rightJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      fullJoin: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      execute: vi.fn().mockImplementation(() => {
        let result = data;
        
        // Apply basic filtering (simplified)
        if (whereConditions.length > 0) {
          // For empty arrays in filters, return empty result
          const hasEmptyArrayFilter = whereConditions.some(condition => 
            condition && Array.isArray(condition.value) && condition.value.length === 0
          );
          if (hasEmptyArrayFilter) {
            result = [];
          }
        }
        
        // Apply offset
        if (offsetValue !== undefined) {
          result = result.slice(offsetValue);
        }
        // Apply limit
        if (limitValue !== undefined) {
          result = result.slice(0, limitValue);
        }
        return Promise.resolve(result);
      }),
      then: vi.fn().mockImplementation(resolve => {
        let result = data;
        
        // Apply basic filtering (simplified)
        if (whereConditions.length > 0) {
          // For empty arrays in filters, return empty result
          const hasEmptyArrayFilter = whereConditions.some(condition => 
            condition && Array.isArray(condition.value) && condition.value.length === 0
          );
          if (hasEmptyArrayFilter) {
            result = [];
          }
        }
        
        // Apply offset
        if (offsetValue !== undefined) {
          result = result.slice(offsetValue);
        }
        // Apply limit
        if (limitValue !== undefined) {
          result = result.slice(0, limitValue);
        }
        return resolve(result);
      }),
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
        
        // Basic validation for users table
        if (tableName === 'users') {
          for (const data of dataArray) {
            if (!data.name || !data.email) {
              throw new ValidationError(`Missing required fields for ${tableName}`);
            }
            
            // Validate empty strings
            if (data.name === '' || data.email === '') {
              throw new ValidationError(`Empty string not allowed for required fields`);
            }
            
            // Validate NaN and Infinity values
            if (data.age !== undefined && data.age !== null) {
              if (typeof data.age === 'number' && (isNaN(data.age) || !isFinite(data.age))) {
                throw new ValidationError(`Invalid numeric value for age`);
              }
            }
            
            // Validate invalid dates
            if (data.createdAt && data.createdAt instanceof Date && isNaN(data.createdAt.getTime())) {
              throw new ValidationError(`Invalid date value`);
            }
            
            // Validate nested arrays (should not be allowed in simple fields)
            for (const [key, value] of Object.entries(data)) {
              if (Array.isArray(value)) {
                throw new ValidationError(`Nested arrays not supported in field ${key}`);
              }
            }
          }
        }
        
        const resultData = dataArray.map((data, index) => {
          // Apply defaults and handle null vs undefined for optional fields
          const baseData = {
            id: index + 1,
            createdAt: new Date(),
            isActive: true, // Default value from schema
            age: null, // Optional field defaults to null if not provided
            ...data, // Use actual input data, overriding defaults
          };
          
          // Ensure optional fields that weren't provided are null, not undefined
          if (!('age' in data)) {
            baseData.age = null;
          }
          
          return baseData;
        });
        
        // Store created records for later updates
        if (!createdRecords[tableName]) {
          createdRecords[tableName] = [];
        }
        createdRecords[tableName].push(...resultData);
        
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
  const createUpdateChain = (tableName: string) => {
    let updateValues = {};
    
    return {
      set: vi
        .fn()
        .mockImplementation((values) => {
          updateValues = values;
          return {
            where: vi
              .fn()
              .mockImplementation((condition) => {
                // Try to find the record to update from created records first, then fallback to mock data
                const allRecords = [...(createdRecords[tableName] || []), ...(mockData[tableName] || [])];
                const baseRecord = allRecords[0] || {};
                
                return {
                  returning: vi
                    .fn()
                    .mockReturnValue({
                      execute: vi
                        .fn()
                        .mockResolvedValue([
                          { 
                            ...baseRecord,
                            ...updateValues 
                          },
                        ]),
                    }),
                  execute: vi
                    .fn()
                    .mockResolvedValue([
                      { 
                        ...baseRecord,
                        ...updateValues 
                      },
                    ]),
                };
              }),
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi
                  .fn()
                  .mockResolvedValue([
                    { 
                      id: 1, 
                      ...(mockData[tableName]?.[0] || {}), 
                      ...updateValues 
                    },
                  ]),
              }),
            execute: vi
              .fn()
              .mockResolvedValue([
                { 
                  id: 1, 
                  ...(mockData[tableName]?.[0] || {}), 
                  ...updateValues 
                }
              ]),
          };
        })
    };
  };

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
    transaction: vi.fn().mockImplementation(async (callback: (tx: any) => Promise<any>) => {
      const txClient = createMockDrizzleClient(schema, mockData);
      
      try {
        const result = await callback(txClient);
        return result;
      } catch (error) {
        // Simulate transaction rollback on error
        console.debug('Transaction rolled back due to error:', error);
        throw error;
      }
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
      throw new ConnectionError('Connection lost');
    });
    (this.executeRaw as any) = vi.fn().mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
  }

  simulateQueryError(): void {
    (this.mockClient.select as any).mockImplementation(() => {
      throw new QueryError('SQL syntax error');
    });
    (this.executeRaw as any) = vi.fn().mockImplementation(() => {
      throw new QueryError('SQL syntax error'); 
    });
  }

  simulateTimeout(ms: number = 5000): void {
    (this.mockClient.select as any).mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new QueryError('Query timeout')), ms);
      });
    });
    (this.executeRaw as any) = vi.fn().mockImplementation(() => {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new QueryError('Query timeout')), ms);
      });
    });
  }

  simulateValidationError(): void {
    (this.mockClient.insert as any).mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        throw new ValidationError('Invalid data');
      })
    }));
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
      isActive: true, // Default value from schema
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
    return new ConnectionError('ECONNREFUSED: Connection refused');
  },

  queryError: () => {
    return new QueryError('syntax error at or near "SELCT"');
  },

  constraintError: () => {
    return new ValidationError(
      'duplicate key value violates unique constraint "users_email_unique"'
    );
  },

  timeoutError: () => {
    return new QueryError('Query timeout');
  },

  validationError: () => {
    return new ValidationError('Invalid email format');
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
