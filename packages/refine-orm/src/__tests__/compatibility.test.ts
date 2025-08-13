/**
 * Basic Compatibility Tests
 * Tests basic CRUD operations consistency across different databases
 * and verifies type inference correctness
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import { DatabaseTestSetup, TEST_DATA } from './integration/database-setup.js';
import type { RefineOrmDataProvider } from '../types/client.js';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  pgUsers,
  mysqlUsers,
  sqliteUsers,
} from './integration/database-setup.js';

const testSetup = new DatabaseTestSetup();

// Test databases to run against
const TEST_DATABASES = [
  { type: 'sqlite' as const, name: 'SQLite', schema: { users: sqliteUsers } },
  {
    type: 'postgresql' as const,
    name: 'PostgreSQL',
    schema: { users: pgUsers },
  },
  { type: 'mysql' as const, name: 'MySQL', schema: { users: mysqlUsers } },
] as const;

describe('Basic Compatibility Tests', () => {
  describe('Cross-Database CRUD Consistency', () => {
    // Run the same tests across all database types
    TEST_DATABASES.forEach(({ type: dbType, name: dbName, schema }) => {
      describe(`${dbName} Basic CRUD Operations`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        beforeEach(async () => {
          // Clean and reseed data before each test
          try {
            await testSetup.teardownDatabase(dbType);
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(`Failed to reset database for ${dbName}:`, error);
          }
        }, 15000);

        it('should create a record with consistent behavior', async () => {
          const userData = {
            name: 'Compatibility Test User',
            email: 'compatibility@test.com',
            age: 28,
            isActive: true,
          };

          const result = await provider.create({
            resource: 'users',
            variables: userData,
          });

          // Verify consistent response structure across databases
          expect(result.data).toBeDefined();
          expect(result.data.id).toBeDefined();
          expect(typeof result.data.id).toBe('number');
          expect(result.data.name).toBe(userData.name);
          expect(result.data.email).toBe(userData.email);
          expect(result.data.age).toBe(userData.age);

          // Boolean handling should be consistent
          expect(typeof result.data.isActive).toBe('boolean');
          expect(result.data.isActive).toBe(true);

          // Timestamp handling should be consistent
          expect(result.data.createdAt).toBeDefined();
        });

        it('should read records with consistent behavior', async () => {
          const result = await provider.getOne({ resource: 'users', id: 1 });

          // Verify consistent response structure
          expect(result.data).toBeDefined();
          expect(typeof result.data.id).toBe('number');
          expect(typeof result.data.name).toBe('string');
          expect(typeof result.data.email).toBe('string');
          expect(typeof result.data.age).toBe('number');
          expect(typeof result.data.isActive).toBe('boolean');
          expect(result.data.createdAt).toBeDefined();
        });

        it('should update records with consistent behavior', async () => {
          const updateData = { name: 'Updated Compatibility User', age: 35 };

          const result = await provider.update({
            resource: 'users',
            id: 1,
            variables: updateData,
          });

          // Verify consistent update behavior
          expect(result.data).toBeDefined();
          expect(result.data.id).toBe(1);
          expect(result.data.name).toBe(updateData.name);
          expect(result.data.age).toBe(updateData.age);

          // Unchanged fields should remain the same
          expect(result.data.email).toBe(TEST_DATA.users[0].email);
        });

        it('should delete records with consistent behavior', async () => {
          const result = await provider.deleteOne({ resource: 'users', id: 1 });

          // Verify consistent delete response
          expect(result.data).toBeDefined();
          expect(result.data.id).toBe(1);

          // Verify record is actually deleted
          await expect(
            provider.getOne({ resource: 'users', id: 1 })
          ).rejects.toThrow();
        });

        it('should handle list operations with consistent pagination', async () => {
          const result = await provider.getList({
            resource: 'users',
            pagination: { current: 1, pageSize: 2 },
          });

          // Verify consistent pagination structure
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
          expect(result.data.length).toBeLessThanOrEqual(2);
          expect(typeof result.total).toBe('number');
          expect(result.total).toBeGreaterThanOrEqual(result.data.length);
        });

        it('should handle filtering with consistent operators', async () => {
          const filters: CrudFilters = [
            { field: 'age', operator: 'gte', value: 25 },
          ];

          const result = await provider.getList({ resource: 'users', filters });

          // Verify consistent filtering behavior
          expect(result.data).toBeDefined();
          result.data.forEach(user => {
            expect(user.age).toBeGreaterThanOrEqual(25);
          });
        });

        it('should handle sorting with consistent behavior', async () => {
          const sorters: CrudSorting = [{ field: 'age', order: 'asc' }];

          const result = await provider.getList({ resource: 'users', sorters });

          // Verify consistent sorting behavior
          expect(result.data).toBeDefined();
          for (let i = 1; i < result.data.length; i++) {
            expect(result.data[i].age).toBeGreaterThanOrEqual(
              result.data[i - 1].age
            );
          }
        });

        it('should handle batch operations consistently', async () => {
          const batchData = [
            { name: 'Batch User 1', email: 'batch1@test.com', age: 25 },
            { name: 'Batch User 2', email: 'batch2@test.com', age: 30 },
          ];

          const createResult = await provider.createMany({
            resource: 'users',
            variables: batchData,
          });

          // Verify consistent batch create behavior
          expect(createResult.data).toBeDefined();
          expect(Array.isArray(createResult.data)).toBe(true);
          expect(createResult.data).toHaveLength(2);

          createResult.data.forEach((user, index) => {
            expect(user.id).toBeDefined();
            expect(user.name).toBe(batchData[index].name);
            expect(user.email).toBe(batchData[index].email);
          });

          // Test batch update
          const updateResult = await provider.updateMany({
            resource: 'users',
            ids: createResult.data.map(u => u.id),
            variables: { isActive: false },
          });

          expect(updateResult.data).toHaveLength(2);
          updateResult.data.forEach(user => {
            expect(user.isActive).toBe(false);
          });

          // Test batch delete
          const deleteResult = await provider.deleteMany({
            resource: 'users',
            ids: createResult.data.map(u => u.id),
          });

          expect(deleteResult.data).toHaveLength(2);
        });
      });
    });
  });

  describe('Type Inference Consistency', () => {
    TEST_DATABASES.forEach(({ type: dbType, name: dbName, schema }) => {
      describe(`${dbName} Type Inference`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} type tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        it('should infer correct types for select operations', async () => {
          const result = await provider.getOne({ resource: 'users', id: 1 });

          // Type assertions that should pass at runtime
          expect(typeof result.data.id).toBe('number');
          expect(typeof result.data.name).toBe('string');
          expect(typeof result.data.email).toBe('string');
          expect(typeof result.data.age).toBe('number');
          expect(typeof result.data.isActive).toBe('boolean');

          // Date/timestamp handling varies by database but should be consistent
          expect(result.data.createdAt).toBeDefined();
        });

        it('should validate insert data types correctly', async () => {
          // Valid data should work
          const validData = {
            name: 'Type Test User',
            email: 'typetest@example.com',
            age: 30,
            isActive: true,
          };

          const result = await provider.create({
            resource: 'users',
            variables: validData,
          });

          expect(result.data).toBeDefined();
          expect(typeof result.data.id).toBe('number');

          // Invalid data types should be rejected
          await expect(
            provider.create({
              resource: 'users',
              variables: {
                name: 123, // Should be string
                email: 'test@example.com',
                age: 25,
              } as any,
            })
          ).rejects.toThrow();

          await expect(
            provider.create({
              resource: 'users',
              variables: {
                name: 'Test User',
                email: 'test@example.com',
                age: 'not a number', // Should be number
              } as any,
            })
          ).rejects.toThrow();
        });

        it('should handle null and undefined values consistently', async () => {
          const dataWithNulls = {
            name: 'Null Test User',
            email: 'nulltest@example.com',
            age: null, // Optional field
            isActive: true,
          };

          const result = await provider.create({
            resource: 'users',
            variables: dataWithNulls,
          });

          expect(result.data).toBeDefined();
          expect(result.data.age).toBeNull();
        });

        it('should maintain type safety in chain queries', async () => {
          if (typeof provider.from === 'function') {
            const query = provider.from('users');

            // These operations should maintain type safety
            const result = await query
              .where('age', 'gte', 18)
              .where('isActive', 'eq', true)
              .orderBy('name', 'asc')
              .limit(5)
              .get();

            expect(Array.isArray(result)).toBe(true);

            if (result.length > 0) {
              expect(typeof result[0].id).toBe('number');
              expect(typeof result[0].name).toBe('string');
              expect(typeof result[0].email).toBe('string');
              expect(typeof result[0].age).toBe('number');
              expect(typeof result[0].isActive).toBe('boolean');
            }
          }
        });
      });
    });
  });

  describe('Error Handling Consistency', () => {
    TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
      describe(`${dbName} Error Handling`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} error tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        it('should handle non-existent records consistently', async () => {
          await expect(
            provider.getOne({ resource: 'users', id: 999999 })
          ).rejects.toThrow();

          await expect(
            provider.update({
              resource: 'users',
              id: 999999,
              variables: { name: 'Updated' },
            })
          ).rejects.toThrow();

          await expect(
            provider.deleteOne({ resource: 'users', id: 999999 })
          ).rejects.toThrow();
        });

        it('should handle constraint violations consistently', async () => {
          // Try to create user with duplicate email
          await expect(
            provider.create({
              resource: 'users',
              variables: {
                name: 'Duplicate User',
                email: TEST_DATA.users[0].email, // Should already exist
                age: 25,
              },
            })
          ).rejects.toThrow();
        });

        it('should handle invalid resource names consistently', async () => {
          await expect(
            provider.getList({ resource: 'nonexistent_table' as any })
          ).rejects.toThrow();
        });

        it('should handle malformed queries consistently', async () => {
          const invalidFilters: CrudFilters = [
            {
              field: 'nonexistent_field' as any,
              operator: 'eq',
              value: 'test',
            },
          ];

          await expect(
            provider.getList({ resource: 'users', filters: invalidFilters })
          ).rejects.toThrow();
        });
      });
    });
  });

  describe('Performance Consistency', () => {
    TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
      describe(`${dbName} Performance`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} performance tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        it('should handle bulk operations within reasonable time', async () => {
          const bulkData = Array.from({ length: 50 }, (_, i) => ({
            name: `Bulk User ${i}`,
            email: `bulk${i}@perf.com`,
            age: 20 + (i % 50),
          }));

          const startTime = Date.now();
          const result = await provider.createMany({
            resource: 'users',
            variables: bulkData,
          });
          const duration = Date.now() - startTime;

          expect(result.data).toHaveLength(50);
          expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
        });

        it('should handle complex queries efficiently', async () => {
          const startTime = Date.now();
          const result = await provider.getList({
            resource: 'users',
            filters: [
              { field: 'age', operator: 'gte', value: 20 },
              { field: 'isActive', operator: 'eq', value: true },
            ],
            sorters: [
              { field: 'name', order: 'asc' },
              { field: 'age', order: 'desc' },
            ],
            pagination: { current: 1, pageSize: 10 },
          });
          const duration = Date.now() - startTime;

          expect(result.data).toBeDefined();
          expect(duration).toBeLessThan(1000); // Should complete within 1 second
        });
      });
    });
  });

  describe('Data Type Compatibility', () => {
    TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
      describe(`${dbName} Data Types`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} data type tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        it('should handle string data consistently', async () => {
          const testStrings = [
            'Simple string',
            'String with "quotes"',
            "String with 'apostrophes'",
            'String with\nnewlines',
            'String with special chars: !@#$%^&*()',
            'Unicode string: 你好世界 🌍',
          ];

          for (const testString of testStrings) {
            const result = await provider.create({
              resource: 'users',
              variables: {
                name: testString,
                email: `test-${Date.now()}@example.com`,
                age: 25,
              },
            });

            expect(result.data.name).toBe(testString);
          }
        });

        it('should handle numeric data consistently', async () => {
          const testNumbers = [0, 1, -1, 100, 999999, 18, 65];

          for (const testNumber of testNumbers) {
            const result = await provider.create({
              resource: 'users',
              variables: {
                name: `User ${testNumber}`,
                email: `user${testNumber}-${Date.now()}@example.com`,
                age: testNumber,
              },
            });

            expect(result.data.age).toBe(testNumber);
            expect(typeof result.data.age).toBe('number');
          }
        });

        it('should handle boolean data consistently', async () => {
          const testBooleans = [true, false];

          for (const testBoolean of testBooleans) {
            const result = await provider.create({
              resource: 'users',
              variables: {
                name: `User ${testBoolean}`,
                email: `bool${testBoolean}-${Date.now()}@example.com`,
                age: 25,
                isActive: testBoolean,
              },
            });

            expect(result.data.isActive).toBe(testBoolean);
            expect(typeof result.data.isActive).toBe('boolean');
          }
        });

        it('should handle date/timestamp data consistently', async () => {
          const result = await provider.create({
            resource: 'users',
            variables: {
              name: 'Date Test User',
              email: `datetest-${Date.now()}@example.com`,
              age: 30,
            },
          });

          // All databases should provide some form of timestamp
          expect(result.data.createdAt).toBeDefined();

          // The exact type may vary (Date, string, number) but should be consistent within each database
          const timestampType = typeof result.data.createdAt;
          expect(['string', 'object', 'number']).toContain(timestampType);
        });
      });
    });
  });

  describe('Query Operator Compatibility', () => {
    TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
      describe(`${dbName} Query Operators`, () => {
        let provider: RefineOrmDataProvider<any>;

        beforeAll(async () => {
          try {
            provider = await testSetup.setupDatabase(dbType);
          } catch (error) {
            console.warn(
              `Skipping ${dbName} operator tests due to setup failure:`,
              error
            );
            throw error;
          }
        }, 30000);

        afterAll(async () => {
          await testSetup.teardownDatabase(dbType);
        }, 10000);

        it('should support equality operators consistently', async () => {
          const filters: CrudFilters = [
            { field: 'name', operator: 'eq', value: TEST_DATA.users[0].name },
          ];

          const result = await provider.getList({ resource: 'users', filters });

          expect(result.data.length).toBeGreaterThan(0);
          result.data.forEach(user => {
            expect(user.name).toBe(TEST_DATA.users[0].name);
          });
        });

        it('should support comparison operators consistently', async () => {
          const operators = ['gt', 'gte', 'lt', 'lte'] as const;

          for (const operator of operators) {
            const filters: CrudFilters = [
              { field: 'age', operator, value: 30 },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            result.data.forEach(user => {
              switch (operator) {
                case 'gt':
                  expect(user.age).toBeGreaterThan(30);
                  break;
                case 'gte':
                  expect(user.age).toBeGreaterThanOrEqual(30);
                  break;
                case 'lt':
                  expect(user.age).toBeLessThan(30);
                  break;
                case 'lte':
                  expect(user.age).toBeLessThanOrEqual(30);
                  break;
              }
            });
          }
        });

        it('should support IN operator consistently', async () => {
          const filters: CrudFilters = [
            { field: 'id', operator: 'in', value: [1, 2] },
          ];

          const result = await provider.getList({ resource: 'users', filters });

          expect(result.data.length).toBeGreaterThan(0);
          result.data.forEach(user => {
            expect([1, 2]).toContain(user.id);
          });
        });

        it('should support LIKE operator consistently', async () => {
          const filters: CrudFilters = [
            { field: 'email', operator: 'contains', value: 'example.com' },
          ];

          const result = await provider.getList({ resource: 'users', filters });

          result.data.forEach(user => {
            expect(user.email).toContain('example.com');
          });
        });
      });
    });
  });
});
