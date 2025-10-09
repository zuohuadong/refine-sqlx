/**
 * Mock utilities for testing RefineORM components
 * Provides comprehensive mock implementations for database clients and adapters
 */

import { expect, jest } from '../test-utils.js';
import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type { DrizzleClient } from '../../types/client';
import { BaseDatabaseAdapter } from '../../adapters/base';
import type { DatabaseConfig } from '../../types/config';
import {
  ValidationError,
  ConnectionError,
  QueryError,
} from '../../types/errors';

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
    const whereConditions: any[] = [];

    const chain = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockImplementation((condition: any) => {
        // Store simplified conditions for filtering
        // Try to extract the actual filtering criteria from drizzle conditions
        if (condition) {
          // Extract filter from drizzle SQL expression
          if (condition.queryChunks && Array.isArray(condition.queryChunks)) {
            // Remove debug logging
            // console.log('IN condition chunks:', condition.queryChunks.length);

            // Look for pattern: [column, operator, value]
            // Usually: chunk[1] = column, chunk[2] = operator, chunk[3] = value
            if (condition.queryChunks.length >= 4) {
              const columnChunk = condition.queryChunks[1];
              const operatorChunk = condition.queryChunks[2];
              const valueChunk = condition.queryChunks[3];

              if (columnChunk?.name) {
                const fieldName = columnChunk.name;

                // Check if it's an array of Param objects (for IN operator)
                if (Array.isArray(valueChunk)) {
                  // Extract values from array of Param objects
                  const values = valueChunk.map((param: any) =>
                    param && param.value !== undefined ? param.value : param
                  );
                  whereConditions.push({
                    field: fieldName,
                    op: 'in',
                    value: values,
                  });
                } else if (valueChunk && valueChunk.value !== undefined) {
                  const value = valueChunk.value;

                  // Check operator type
                  if (
                    operatorChunk?.value?.[0]
                  ) {
                    const op = operatorChunk.value[0].trim();
                    if (op === '=') {
                      whereConditions.push({
                        field: fieldName,
                        op: 'eq',
                        value,
                      });
                    } else if (op === 'IN' || op === 'in') {
                      whereConditions.push({
                        field: fieldName,
                        op: 'in',
                        value,
                      });
                    }
                  }
                }
              }
            }
            // Also check for inArray pattern with Placeholder
            else if (condition.queryChunks.length >= 3) {
              const columnChunk = condition.queryChunks[1];
              const placeholderChunk =
                condition.queryChunks[condition.queryChunks.length - 2];

              if (
                columnChunk &&
                columnChunk.name === 'id' &&
                placeholderChunk &&
                placeholderChunk.name === 'id' &&
                Array.isArray(placeholderChunk.value)
              ) {
                // This is an inArray with values embedded in the Placeholder
                whereConditions.push({
                  field: 'id',
                  op: 'in',
                  value: placeholderChunk.value,
                });
              }
            }
          } else if (condition.values && Array.isArray(condition.values)) {
            // For inArray conditions
            whereConditions.push({
              field: 'id',
              op: 'in',
              value: condition.values,
            });
          } else {
            // Fallback: try string matching
            const condStr = String(condition);
            const idMatch = condStr.match(/id\s*=\s*(\d+)/i);
            if (idMatch) {
              whereConditions.push({
                field: 'id',
                op: 'eq',
                value: parseInt(idMatch[1]),
              });
            } else {
              // Store raw condition for later processing
              whereConditions.push(condition);
            }
          }
        }
        return chain;
      }),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation((value: number) => {
        limitValue = value;
        return chain;
      }),
      offset: jest.fn().mockImplementation((value: number) => {
        offsetValue = value;
        return chain;
      }),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      rightJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      fullJoin: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      execute: jest.fn().mockImplementation(() => {
        let result = data;

        // Apply basic filtering
        if (whereConditions.length > 0) {
          // For empty arrays in filters, return empty result
          const hasEmptyArrayFilter = whereConditions.some(
            condition =>
              condition &&
              Array.isArray(condition.value) &&
              condition.value.length === 0
          );
          if (hasEmptyArrayFilter) {
            result = [];
          } else {
            // Apply actual filtering for conditions
            result = result.filter(record => whereConditions.every(condition => {
                // Handle simplified conditions
                if (condition?.field && condition.op) {
                  const fieldValue = record[condition.field];

                  if (condition.op === 'eq') {
                    return fieldValue === condition.value;
                  } else if (
                    condition.op === 'in' &&
                    Array.isArray(condition.value)
                  ) {
                    return condition.value.includes(fieldValue);
                  }
                }

                // For raw conditions, try basic pattern matching
                if (condition) {
                  const condStr = String(condition);
                  // Check for ID equality in the condition string
                  if (condStr.includes('id') && record.id !== undefined) {
                    const match = condStr.match(/(\d+)/);
                    if (match) {
                      return record.id === parseInt(match[1]);
                    }
                  }
                }

                // Default to true for unhandled conditions
                return true;
              }));
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
      then: jest.fn().mockImplementation((resolve: any) => {
        let result = data;

        // Apply basic filtering
        if (whereConditions.length > 0) {
          // For empty arrays in filters, return empty result
          const hasEmptyArrayFilter = whereConditions.some(
            condition =>
              condition &&
              Array.isArray(condition.value) &&
              condition.value.length === 0
          );
          if (hasEmptyArrayFilter) {
            result = [];
          } else {
            // Apply actual filtering for conditions
            result = result.filter(record => whereConditions.every(condition => {
                // Handle simplified conditions
                if (condition?.field && condition.op) {
                  const fieldValue = record[condition.field];

                  if (condition.op === 'eq') {
                    return fieldValue === condition.value;
                  } else if (
                    condition.op === 'in' &&
                    Array.isArray(condition.value)
                  ) {
                    return condition.value.includes(fieldValue);
                  }
                }

                // For raw conditions, try basic pattern matching
                if (condition) {
                  const condStr = String(condition);
                  // Check for ID equality in the condition string
                  if (condStr.includes('id') && record.id !== undefined) {
                    const match = condStr.match(/(\d+)/);
                    if (match) {
                      return record.id === parseInt(match[1]);
                    }
                  }
                }

                // Default to true for unhandled conditions
                return true;
              }));
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
  const createInsertChain = (tableName: string) => {
    let storedResultData: any[] = [];

    const insertChain = {
      values: jest.fn().mockImplementation((values: any) => {
        // Handle both single and multiple inserts
        const dataArray = Array.isArray(values) ? values : [values];

        // Basic validation for users table
        if (tableName === 'users') {
          for (const data of dataArray) {
            if (!data.name || !data.email) {
              throw new ValidationError(
                `Missing required fields for ${tableName}`
              );
            }

            // Validate empty strings
            if (data.name === '' || data.email === '') {
              throw new ValidationError(
                `Empty string not allowed for required fields`
              );
            }

            // Validate NaN and Infinity values
            if (data.age !== undefined && data.age !== null) {
              if (
                typeof data.age === 'number' &&
                (isNaN(data.age) || !isFinite(data.age))
              ) {
                throw new ValidationError(`Invalid numeric value for age`);
              }
            }

            // Validate invalid dates
            if (
              data.createdAt &&
              data.createdAt instanceof Date &&
              isNaN(data.createdAt.getTime())
            ) {
              throw new ValidationError(`Invalid date value`);
            }

            // Validate nested arrays (should not be allowed in simple fields)
            for (const [key, value] of Object.entries(data)) {
              if (Array.isArray(value)) {
                throw new ValidationError(
                  `Nested arrays not supported in field ${key}`
                );
              }
            }
          }
        }

        const resultData = dataArray.map((data, index) => {
          // Calculate next ID based on existing records
          const existingRecords = [
            ...(mockData[tableName] || []),
            ...(createdRecords[tableName] || []),
          ];
          const maxId = existingRecords.reduce((max, record) => Math.max(max, record.id || 0), 0);

          // Apply defaults and handle null vs undefined for optional fields
          const baseData = {
            id: maxId + index + 1,
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

        // Store result data for returning() method
        storedResultData = resultData;

        return {
          returning: jest
            .fn()
            .mockReturnValue({
              execute: jest.fn().mockResolvedValue(resultData),
            }),
          onConflictDoNothing: jest
            .fn()
            .mockReturnValue({
              returning: jest
                .fn()
                .mockReturnValue({ execute: jest.fn().mockResolvedValue([]) }),
            }),
          onConflictDoUpdate: jest
            .fn()
            .mockReturnValue({
              returning: jest
                .fn()
                .mockReturnValue({
                  execute: jest.fn().mockResolvedValue(resultData),
                }),
            }),
          execute: jest.fn().mockResolvedValue(resultData),
        };
      }),
      // Add returning method at the top level for when it's called directly
      returning: jest
        .fn()
        .mockImplementation(() => ({
          execute: jest.fn().mockResolvedValue(storedResultData),
        })),
    };

    return insertChain;
  };

  // Create update chain mock
  const createUpdateChain = (tableName: string) => {
    let updateValues = {};
    let updateConditions: any[] = [];

    return {
      set: jest.fn().mockImplementation((values: any) => {
        updateValues = values;
        return {
          where: jest.fn().mockImplementation((condition: any) => {
            // Extract IDs to update from the condition
            if (
              condition?.queryChunks &&
              Array.isArray(condition.queryChunks)
            ) {
              if (condition.queryChunks.length >= 4) {
                const columnChunk = condition.queryChunks[1];
                const valueChunk = condition.queryChunks[3];

                if (columnChunk && columnChunk.name === 'id') {
                  // Check if it's an array of Param objects (for IN operator)
                  if (Array.isArray(valueChunk)) {
                    // Extract values from array of Param objects
                    const ids = valueChunk.map((param: any) =>
                      param && param.value !== undefined ? param.value : param
                    );
                    updateConditions = ids;
                  } else if (valueChunk && valueChunk.value !== undefined) {
                    updateConditions = [valueChunk.value];
                  }
                }
              }
            }

            // Find and update the records
            const allData = [
              ...(mockData[tableName] || []),
              ...(createdRecords[tableName] || []),
            ];

            const updatedRecords =
              updateConditions.length > 0 ?
                allData
                  .filter(record => updateConditions.includes(record.id))
                  .map(record => ({ ...record, ...updateValues }))
              : [{ ...allData[0], ...updateValues }];

            return {
              returning: jest
                .fn()
                .mockReturnValue({
                  execute: jest
                    .fn()
                    .mockResolvedValue(
                      updatedRecords.length > 0 ?
                        updatedRecords
                      : [{ id: updateConditions[0] || 1, ...updateValues }]
                    ),
                }),
              execute: jest
                .fn()
                .mockResolvedValue(
                  updatedRecords.length > 0 ?
                    updatedRecords
                  : [{ id: updateConditions[0] || 1, ...updateValues }]
                ),
            };
          }),
          returning: jest
            .fn()
            .mockReturnValue({
              execute: jest
                .fn()
                .mockResolvedValue([
                  {
                    id: 1,
                    ...(mockData[tableName]?.[0] || {}),
                    ...updateValues,
                  },
                ]),
            }),
          execute: jest
            .fn()
            .mockResolvedValue([
              { id: 1, ...(mockData[tableName]?.[0] || {}), ...updateValues },
            ]),
        };
      }),
    };
  };

  // Create delete chain mock
  const createDeleteChain = (tableName: string) => {
    const deleteConditions: any[] = [];

    const chain = {
      where: jest.fn().mockImplementation((condition: any) => {
        // Extract the ID(s) to delete from the condition
        if (
          condition?.queryChunks &&
          Array.isArray(condition.queryChunks)
        ) {
          // Handle single ID condition (id = value)
          if (condition.queryChunks.length >= 4) {
            const columnChunk = condition.queryChunks[1];
            const valueChunk = condition.queryChunks[3];

            if (columnChunk && columnChunk.name === 'id' && valueChunk) {
              // Handle array of values (for inArray)
              if (Array.isArray(valueChunk)) {
                // Extract values from Param objects
                for (const param of valueChunk) {
                  if (param && param.value !== undefined) {
                    deleteConditions.push(param.value);
                  } else if (
                    typeof param === 'number' ||
                    typeof param === 'string'
                  ) {
                    deleteConditions.push(param);
                  }
                }
              }
              // Handle single value
              else if (valueChunk.value !== undefined) {
                deleteConditions.push(valueChunk.value);
              }
            }
          }
          // Handle inArray condition with Placeholder
          else if (condition.queryChunks.length >= 2) {
            // Check all chunks for placeholder with array value
            for (const chunk of condition.queryChunks) {
              if (chunk?.value && Array.isArray(chunk.value)) {
                deleteConditions.push(...chunk.value);
                break;
              }
            }
          }
        }
        // Also check for direct values array (for inArray)
        else if (
          condition?.values &&
          Array.isArray(condition.values)
        ) {
          deleteConditions.push(...condition.values);
        }
        return chain;
      }),
      returning: jest.fn().mockImplementation(() => ({
        execute: jest.fn().mockImplementation(() => {
          // Find and return the record(s) to be deleted
          const allData = [
            ...(mockData[tableName] || []),
            ...(createdRecords[tableName] || []),
          ];

          const deletedRecords = allData.filter(record =>
            deleteConditions.includes(record.id)
          );

          // Return the deleted records (before actually removing them)
          return Promise.resolve(
            deletedRecords.length > 0 ? deletedRecords
            : deleteConditions.length > 0 ? deleteConditions.map(id => ({ id }))
            : [{ id: undefined }]
          );
        }),
      })),
      execute: jest.fn().mockImplementation(() => {
        // Find and return the record(s) to be deleted
        const allData = [
          ...(mockData[tableName] || []),
          ...(createdRecords[tableName] || []),
        ];

        const deletedRecords = allData.filter(record =>
          deleteConditions.includes(record.id)
        );

        return Promise.resolve(
          deletedRecords.length > 0 ?
            deletedRecords
          : [{ id: deleteConditions[0] }]
        );
      }),
    };

    return chain;
  };

  // Create count query mock
  const createCountQuery = (tableName: string) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest
      .fn()
      .mockResolvedValue([{ count: mockData[tableName]?.length || 0 }]),
  });

  // Create aggregate query mock
  const createAggregateQuery = (tableName: string, aggregateValue: number) => ({
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([{ value: aggregateValue }]),
  });

  return {
    schema,
    select: jest.fn().mockImplementation((fields: any) => {
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

      // Combine mock data with created records
      const allData = [
        ...(mockData[tableName] || []),
        ...(createdRecords[tableName] || []),
      ];
      return createQueryChain(tableName, allData);
    }),
    insert: jest.fn().mockImplementation((table: any) => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createInsertChain(tableName);
    }),
    update: jest.fn().mockImplementation((table: any) => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createUpdateChain(tableName);
    }),
    delete: jest.fn().mockImplementation((table: any) => {
      const tableName =
        Object.keys(schema).find(key => schema[key] === table) || 'unknown';
      return createDeleteChain(tableName);
    }),
    execute: jest.fn().mockResolvedValue([]),
    transaction: jest
      .fn()
      .mockImplementation(async (callback: (tx: any) => Promise<any>) => {
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
    // Don't set isConnected = false to avoid ConfigurationError in getClient()
    // Instead, just mock the client methods to throw ConnectionError
    (this.mockClient.select as any).mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
    (this.mockClient.insert as any).mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
    (this.mockClient.update as any).mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
    (this.mockClient.delete as any).mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
    (this.executeRaw as any) = jest.fn().mockImplementation(() => {
      throw new ConnectionError('Connection lost');
    });
  }

  simulateQueryError(): void {
    (this.mockClient.select as any).mockImplementation(() => {
      throw new QueryError('SQL syntax error');
    });
    (this.executeRaw as any) = jest.fn().mockImplementation(() => {
      throw new QueryError('SQL syntax error');
    });
  }

  simulateTimeout(ms: number = 5000): void {
    (this.mockClient.select as any).mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new QueryError('Query timeout')), ms);
      }));
    (this.executeRaw as any) = jest.fn().mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => reject(new QueryError('Query timeout')), ms);
      }));
  }

  simulateValidationError(): void {
    (this.mockClient.insert as any).mockImplementation(() => ({
      values: jest.fn().mockImplementation(() => {
        throw new ValidationError('Invalid data');
      }),
    }));
  }

  resetMocks(): void {
    jest.clearAllMocks();
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
  connectionError: () => new ConnectionError('ECONNREFUSED: Connection refused'),

  queryError: () => new QueryError('syntax error at or near "SELCT"'),

  constraintError: () => new ValidationError(
      'duplicate key value violates unique constraint "users_email_unique"'
    ),

  timeoutError: () => new QueryError('Query timeout'),

  validationError: () => new ValidationError('Invalid email format'),
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
