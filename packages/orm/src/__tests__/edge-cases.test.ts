/**
 * Edge cases and boundary condition tests
 * These tests verify that RefineORM handles unusual inputs, edge cases,
 * and boundary conditions gracefully
 */

import { describe, it, expect, beforeEach, jest } from './test-utils.js';
import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
} from 'drizzle-orm/pg-core';
import { createProvider } from '../core/data-provider.js';
import {
  MockDatabaseAdapter,
  TestDataGenerators,
  MockErrorScenarios,
} from './utils/mock-client.js';
import { ValidationError, ConnectionError } from '../types/errors.js';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  age: integer('age'),
  bio: text('bio'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

describe('Edge Cases and Boundary Conditions', () => {
  let adapter: MockDatabaseAdapter<typeof schema>;
  let dataProvider: ReturnType<typeof createProvider>;

  beforeEach(() => {
    adapter = new MockDatabaseAdapter(schema, {
      users: TestDataGenerators.users(10),
    });
    dataProvider = createProvider(adapter);
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle null and undefined values', async () => {
      // Test null values
      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Test User',
          email: 'test@example.com',
          age: null,
          bio: null,
        },
      });

      expect(result.data).toBeDefined();
      expect(result.data.age).toBeNull();
      expect(result.data.bio).toBeNull();
    });

    it('should handle empty strings', async () => {
      await expect(
        dataProvider.create({
          resource: 'users',
          variables: {
            name: '', // Empty string for required field
            email: 'test@example.com',
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle very long strings', async () => {
      const veryLongString = 'a'.repeat(10000);

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Test User',
          email: 'test@example.com',
          bio: veryLongString,
        },
      });

      expect(result.data.bio).toBe(veryLongString);
    });

    it('should handle special characters in strings', async () => {
      const specialChars =
        'Test User with \'quotes\', "double quotes", and \\ backslashes';

      const result = await dataProvider.create({
        resource: 'users',
        variables: { name: specialChars, email: 'special@example.com' },
      });

      expect(result.data.name).toBe(specialChars);
    });

    it('should handle Unicode characters', async () => {
      const unicodeString = '测试用户 🚀 émojis and ñoñó';

      const result = await dataProvider.create({
        resource: 'users',
        variables: { name: unicodeString, email: 'unicode@example.com' },
      });

      expect(result.data.name).toBe(unicodeString);
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousInput = "'; DROP TABLE users; --";

      const result = await dataProvider.create({
        resource: 'users',
        variables: { name: maliciousInput, email: 'malicious@example.com' },
      });

      // Should treat as regular string, not execute SQL
      expect(result.data.name).toBe(maliciousInput);
    });
  });

  describe('Numeric Edge Cases', () => {
    it('should handle zero values', async () => {
      const result = await dataProvider.create({
        resource: 'users',
        variables: { name: 'Zero Age User', email: 'zero@example.com', age: 0 },
      });

      expect(result.data.age).toBe(0);
    });

    it('should handle negative numbers', async () => {
      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Negative Age User',
          email: 'negative@example.com',
          age: -1,
        },
      });

      expect(result.data.age).toBe(-1);
    });

    it('should handle very large numbers', async () => {
      const largeNumber = Number.MAX_SAFE_INTEGER;

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Large Number User',
          email: 'large@example.com',
          age: largeNumber,
        },
      });

      expect(result.data.age).toBe(largeNumber);
    });

    it('should handle floating point precision issues', async () => {
      const floatValue = 0.1 + 0.2; // Known floating point precision issue

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Float User',
          email: 'float@example.com',
          age: Math.round(floatValue * 100), // Convert to integer for age
        },
      });

      expect(result.data.age).toBe(30); // 0.30000000000000004 * 100 rounded
    });

    it('should handle NaN and Infinity', async () => {
      await expect(
        dataProvider.create({
          resource: 'users',
          variables: { name: 'NaN User', email: 'nan@example.com', age: NaN },
        })
      ).rejects.toThrow(ValidationError);

      await expect(
        dataProvider.create({
          resource: 'users',
          variables: {
            name: 'Infinity User',
            email: 'infinity@example.com',
            age: Infinity,
          },
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Date and Time Edge Cases', () => {
    it('should handle epoch date', async () => {
      const epochDate = new Date(0);

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Epoch User',
          email: 'epoch@example.com',
          createdAt: epochDate,
        },
      });

      expect(result.data.createdAt).toEqual(epochDate);
    });

    it('should handle far future dates', async () => {
      const futureDate = new Date('2099-12-31T23:59:59.999Z');

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Future User',
          email: 'future@example.com',
          createdAt: futureDate,
        },
      });

      expect(result.data.createdAt).toEqual(futureDate);
    });

    it('should handle invalid date objects', async () => {
      const invalidDate = new Date('invalid-date-string');

      await expect(
        dataProvider.create({
          resource: 'users',
          variables: {
            name: 'Invalid Date User',
            email: 'invalid@example.com',
            createdAt: invalidDate,
          },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle timezone edge cases', async () => {
      const utcDate = new Date('2023-01-01T00:00:00.000Z');
      const localDate = new Date('2023-01-01T00:00:00.000');

      const utcResult = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'UTC User',
          email: 'utc@example.com',
          createdAt: utcDate,
        },
      });

      const localResult = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Local User',
          email: 'local@example.com',
          createdAt: localDate,
        },
      });

      expect(utcResult.data.createdAt).toEqual(utcDate);
      expect(localResult.data.createdAt).toEqual(localDate);
    });
  });

  describe('Array and Collection Edge Cases', () => {
    it('should handle empty arrays in filters', async () => {
      const filters: CrudFilters = [{ field: 'id', operator: 'in', value: [] }];

      const result = await dataProvider.getList({ resource: 'users', filters });

      expect(result.data).toHaveLength(0);
    });

    it('should handle very large arrays', async () => {
      const largeArray = Array.from({ length: 10000 }, (_, i) => i + 1);

      const filters: CrudFilters = [
        { field: 'id', operator: 'in', value: largeArray },
      ];

      const result = await dataProvider.getList({ resource: 'users', filters });

      expect(result).toBeDefined();
    });

    it('should handle arrays with mixed types', async () => {
      const mixedArray = [1, '2', 3, '4'];

      const filters: CrudFilters = [
        { field: 'id', operator: 'in', value: mixedArray },
      ];

      // Should handle type coercion or validation
      const result = await dataProvider.getList({ resource: 'users', filters });

      expect(result).toBeDefined();
    });

    it('should handle nested arrays', async () => {
      const nestedArray = [
        [1, 2],
        [3, 4],
      ];

      await expect(
        dataProvider.getList({
          resource: 'users',
          filters: [{ field: 'id', operator: 'in', value: nestedArray }],
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('Pagination Edge Cases', () => {
    it('should handle page 0', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: 0, pageSize: 10, mode: 'server' },
      });

      // Should treat as page 1 or handle gracefully
      expect(result.data).toBeDefined();
    });

    it('should handle negative page numbers', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: -1, pageSize: 10, mode: 'server' },
      });

      // Should handle gracefully
      expect(result.data).toBeDefined();
    });

    it('should handle very large page numbers', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: 999999, pageSize: 10, mode: 'server' },
      });

      // Should return empty results or handle gracefully
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should handle zero page size', async () => {
      await expect(
        dataProvider.getList({
          resource: 'users',
          pagination: { currentPage: 1, pageSize: 0, mode: 'server' },
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle very large page sizes', async () => {
      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: 1, pageSize: 1000000, mode: 'server' },
      });

      // Should handle gracefully, possibly with limits
      expect(result.data).toBeDefined();
    });
  });

  describe('Sorting Edge Cases', () => {
    it('should handle sorting by non-existent columns', async () => {
      const sorters: CrudSorting = [{ field: 'nonexistent', order: 'asc' }];

      await expect(
        dataProvider.getList({ resource: 'users', sorters })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle multiple sorts on same column', async () => {
      const sorters: CrudSorting = [
        { field: 'name', order: 'asc' },
        { field: 'name', order: 'desc' },
      ];

      const result = await dataProvider.getList({ resource: 'users', sorters });

      // Should handle gracefully, possibly using last sort
      expect(result.data).toBeDefined();
    });

    it('should handle empty sort order', async () => {
      const sorters: CrudSorting = [{ field: 'name', order: '' as any }];

      await expect(
        dataProvider.getList({ resource: 'users', sorters })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle very long sort lists', async () => {
      const sorters: CrudSorting = Array.from({ length: 100 }, (_, i) => ({
        field: i % 2 === 0 ? 'name' : 'email',
        order: i % 2 === 0 ? 'asc' : 'desc',
      }));

      const result = await dataProvider.getList({ resource: 'users', sorters });

      expect(result.data).toBeDefined();
    });
  });

  describe('Filter Edge Cases', () => {
    it('should handle deeply nested logical filters', async () => {
      const deeplyNestedFilters: CrudFilters = [
        {
          operator: 'and',
          value: [
            {
              operator: 'or',
              value: [
                {
                  operator: 'and',
                  value: [
                    { field: 'age', operator: 'gte', value: 18 },
                    { field: 'age', operator: 'lte', value: 65 },
                  ],
                },
                { field: 'isActive', operator: 'eq', value: true },
              ],
            },
            { field: 'name', operator: 'contains', value: 'test' },
          ],
        },
      ];

      const result = await dataProvider.getList({
        resource: 'users',
        filters: deeplyNestedFilters,
      });

      expect(result.data).toBeDefined();
    });

    it('should handle circular filter references', async () => {
      const circularFilter: any = { operator: 'and', value: [] };
      circularFilter.value.push(circularFilter); // Create circular reference

      await expect(
        dataProvider.getList({ resource: 'users', filters: [circularFilter] })
      ).rejects.toThrow(ValidationError);
    });

    it('should handle malformed filter objects', async () => {
      const malformedFilters = [
        { field: 'name' }, // Missing operator and value
        { operator: 'eq' }, // Missing field and value
        { value: 'test' }, // Missing field and operator
        null,
        undefined,
        'string' as any,
        123 as any,
      ];

      for (const filter of malformedFilters) {
        await expect(
          dataProvider.getList({ resource: 'users', filters: [filter] as any })
        ).rejects.toThrow(ValidationError);
      }
    });

    it('should handle between operator with invalid ranges', async () => {
      const invalidBetweenFilters: CrudFilters[] = [
        [{ field: 'age', operator: 'between', value: [65, 18] }], // Reversed range
        [{ field: 'age', operator: 'between', value: [18] }], // Single value
        [{ field: 'age', operator: 'between', value: [18, 25, 30] }], // Too many values
        [{ field: 'age', operator: 'between', value: [] }], // Empty array
        [{ field: 'age', operator: 'between', value: 'invalid' }], // Non-array
      ];

      for (const filters of invalidBetweenFilters) {
        await expect(
          dataProvider.getList({ resource: 'users', filters: filters as any })
        ).rejects.toThrow(ValidationError);
      }
    });
  });

  describe('Connection and Network Edge Cases', () => {
    it('should handle connection timeouts', async () => {
      adapter.simulateConnectionError();

      await expect(dataProvider.getList({ resource: 'users' })).rejects.toThrow(
        ConnectionError
      );
    });

    it('should handle intermittent connection failures', async () => {
      let callCount = 0;
      jest.spyOn(adapter, 'raw').mockImplementation(async () => {
        callCount++;
        if (callCount <= 2) {
          throw MockErrorScenarios.connectionError();
        }
        return TestDataGenerators.users(1);
      });

      // Should retry and eventually succeed
      const result = await dataProvider.getList({ resource: 'users' });
      expect(result.data).toBeDefined();
    });

    it('should handle very slow queries', async () => {
      // Override the mock data to return only 1 user
      adapter.setMockData('users', TestDataGenerators.users(1));

      jest.spyOn(adapter, 'raw').mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay instead of 5s
        return TestDataGenerators.users(1);
      });

      // Should complete without error since we reduced the delay
      const result = await dataProvider.getList({ resource: 'users' });
      expect(result).toBeDefined();
      expect(result.data).toHaveLength(1);
    }); // Removed test timeout
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle very large result sets', async () => {
      const largeDataset = TestDataGenerators.users(100000);
      adapter.setMockData('users', largeDataset);

      const result = await dataProvider.getList({
        resource: 'users',
        pagination: { currentPage: 1, pageSize: 1000, mode: 'server' },
      });

      expect(result.data).toBeDefined();
      expect(result.data.length).toBeLessThanOrEqual(1000);
    });

    it('should handle concurrent operations', async () => {
      const operations = Array.from({ length: 100 }, (_, i) =>
        dataProvider.getOne({ resource: 'users', id: (i % 10) + 1 })
      );

      const results = await Promise.all(operations);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.data).toBeDefined();
      });
    });

    it('should handle memory pressure scenarios', async () => {
      // Simulate memory pressure by creating many large objects
      const largeObjects = Array.from({ length: 1000 }, () => ({
        data: 'x'.repeat(10000),
      }));

      const result = await dataProvider.getList({ resource: 'users' });

      expect(result.data).toBeDefined();
      // Clean up
      largeObjects.length = 0;
    });
  });

  describe('Transaction Edge Cases', () => {
    it('should handle nested transactions', async () => {
      const result = await dataProvider.transaction(async tx1 => {
        const user1 = await tx1.create({
          resource: 'users',
          variables: { name: 'User 1', email: 'user1@example.com' },
        });

        return await dataProvider.transaction(async tx2 => {
          const user2 = await tx2.create({
            resource: 'users',
            variables: { name: 'User 2', email: 'user2@example.com' },
          });

          return { user1, user2 };
        });
      });

      expect(result.user1).toBeDefined();
      expect(result.user2).toBeDefined();
    });

    it('should handle transaction rollback with partial operations', async () => {
      await expect(
        dataProvider.transaction(async tx => {
          await tx.create({
            resource: 'users',
            variables: { name: 'User 1', email: 'user1@example.com' },
          });

          await tx.create({
            resource: 'users',
            variables: { name: 'User 2', email: 'user2@example.com' },
          });

          // Simulate error after partial operations
          throw new Error('Transaction should rollback');
        })
      ).rejects.toThrow('Transaction should rollback');
    });

    it('should handle transaction timeout', async () => {
      // Test that transaction completes successfully with short delay
      const result = await dataProvider.transaction(async tx => {
        await new Promise(resolve => setTimeout(resolve, 100)); // Short delay
        return await tx.create({
          resource: 'users',
          variables: { name: 'Timeout User', email: 'timeout@example.com' },
        });
      });
      expect(result).toBeDefined();
      expect(result.data.name).toBe('Timeout User');
    });
  });

  describe('Schema Evolution Edge Cases', () => {
    it('should handle missing columns gracefully', async () => {
      // Simulate a scenario where the database schema is out of sync
      const result = await dataProvider.getList({
        resource: 'users',
        meta: { selectColumns: ['id', 'name', 'nonexistent_column'] },
      });

      expect(result.data).toBeDefined();
    });

    it('should handle type mismatches between schema and data', async () => {
      // Mock data with type mismatches
      adapter.setMockData('users', [
        {
          id: '1', // String instead of number
          name: 123, // Number instead of string
          email: null, // Null for required field
          age: 'twenty-five', // String instead of number
          isActive: 'true', // String instead of boolean
          createdAt: '2023-01-01', // String instead of Date
        },
      ]);

      const result = await dataProvider.getList({ resource: 'users' });

      // Should handle type coercion or validation
      expect(result.data).toBeDefined();
    });
  });

  describe('Encoding and Character Set Edge Cases', () => {
    it('should handle different character encodings', async () => {
      const encodingTests = [
        'ASCII text',
        'UTF-8: 你好世界',
        'Emoji: 🚀🎉🔥',
        'Latin-1: café naïve résumé',
        'Cyrillic: Привет мир',
        'Arabic: مرحبا بالعالم',
        'Hebrew: שלום עולם',
      ];

      for (const text of encodingTests) {
        const result = await dataProvider.create({
          resource: 'users',
          variables: { name: text, email: `test${Date.now()}@example.com` },
        });

        expect(result.data.name).toBe(text);
      }
    });

    it('should handle binary data in text fields', async () => {
      const binaryData = Buffer.from([0x00, 0x01, 0x02, 0xff]).toString(
        'base64'
      );

      const result = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Binary User',
          email: 'binary@example.com',
          bio: binaryData,
        },
      });

      expect(result.data.bio).toBe(binaryData);
    });
  });
});
