/**
 * End-to-end CRUD operations integration tests
 * Tests all CRUD operations across PostgreSQL, MySQL, and SQLite databases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import {
  DatabaseTestSetup,
  skipIfDatabaseNotAvailable,
  TEST_DATA,
} from './database-setup';
import type { RefineOrmDataProvider } from '../../types/client';

const testSetup = new DatabaseTestSetup();

// Test databases to run against
const TEST_DATABASES = [
  { type: 'sqlite' as const, name: 'SQLite' },
  { type: 'postgresql' as const, name: 'PostgreSQL' },
  { type: 'mysql' as const, name: 'MySQL' },
] as const;

// Run tests for each database type
TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
  describe.skipIf(skipIfDatabaseNotAvailable(dbType))(
    `${dbName} CRUD Operations Integration`,
    () => {
      let provider: RefineOrmDataProvider<any>;

      beforeAll(async () => {
        if (skipIfDatabaseNotAvailable(dbType)) {
          console.warn(`Skipping ${dbName} tests - database not available`);
          return;
        }

        try {
          provider = await testSetup.setupDatabase(dbType);
        } catch (error) {
          console.error(`Failed to setup ${dbName} database:`, error);
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

      describe('Basic CRUD Operations', () => {
        describe('Create Operations', () => {
          it('should create a single record', async () => {
            const userData = {
              name: 'Test User',
              email: 'test@example.com',
              age: 28,
              isActive: true,
            };

            const result = await provider.create({
              resource: 'users',
              variables: userData,
            });

            expect(result.data).toBeDefined();
            expect(result.data.id).toBeDefined();
            expect(result.data.name).toBe(userData.name);
            expect(result.data.email).toBe(userData.email);
            expect(result.data.age).toBe(userData.age);
          });

          it('should create multiple records', async () => {
            const usersData = [
              { name: 'User 1', email: 'user1@test.com', age: 25 },
              { name: 'User 2', email: 'user2@test.com', age: 30 },
              { name: 'User 3', email: 'user3@test.com', age: 35 },
            ];

            const result = await provider.createMany({
              resource: 'users',
              variables: usersData,
            });

            expect(result.data).toHaveLength(3);
            result.data.forEach((user, index) => {
              expect(user.id).toBeDefined();
              expect(user.name).toBe(usersData[index].name);
              expect(user.email).toBe(usersData[index].email);
            });
          });

          it('should handle validation errors gracefully', async () => {
            // Try to create a user without required fields (should fail database validation)
            const invalidUserData = {
              // Missing name field - should fail notNull constraint
              email: 'test@example.com',
              age: 25,
            };

            await expect(
              provider.create({ resource: 'users', variables: invalidUserData })
            ).rejects.toThrow();
          });
        });

        describe('Read Operations', () => {
          it('should get a single record by ID', async () => {
            const result = await provider.getOne({ resource: 'users', id: 1 });

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(1);
            expect(result.data.name).toBe(TEST_DATA.users[0].name);
            expect(result.data.email).toBe(TEST_DATA.users[0].email);
          });

          it('should get multiple records by IDs', async () => {
            const result = await provider.getMany({
              resource: 'users',
              ids: [1, 2],
            });

            expect(result.data).toHaveLength(2);
            expect(result.data[0].id).toBe(1);
            expect(result.data[1].id).toBe(2);
          });

          it('should get a list of records with pagination', async () => {
            const result = await provider.getList({
              resource: 'users',
              pagination: { current: 1, pageSize: 2 },
            });

            expect(result.data).toHaveLength(2);
            expect(result.total).toBeGreaterThanOrEqual(2);
            expect(typeof result.total).toBe('number');
          });

          it('should handle non-existent record gracefully', async () => {
            await expect(
              provider.getOne({ resource: 'users', id: 999999 })
            ).rejects.toThrow();
          });
        });

        describe('Update Operations', () => {
          it('should update a single record', async () => {
            const updateData = { name: 'Updated Name', age: 31 };

            const result = await provider.update({
              resource: 'users',
              id: 1,
              variables: updateData,
            });

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(1);
            expect(result.data.name).toBe(updateData.name);
            expect(result.data.age).toBe(updateData.age);
            // Email should remain unchanged
            expect(result.data.email).toBe(TEST_DATA.users[0].email);
          });

          it('should update multiple records', async () => {
            const updateData = { isActive: false };

            const result = await provider.updateMany({
              resource: 'users',
              ids: [1, 2],
              variables: updateData,
            });

            expect(result.data).toHaveLength(2);
            result.data.forEach(user => {
              expect(user.isActive).toBe(false);
            });
          });

          it('should handle partial updates correctly', async () => {
            const partialUpdate = { age: 40 };

            const result = await provider.update({
              resource: 'users',
              id: 1,
              variables: partialUpdate,
            });

            expect(result.data.age).toBe(40);
            expect(result.data.name).toBe(TEST_DATA.users[0].name); // Should remain unchanged
            expect(result.data.email).toBe(TEST_DATA.users[0].email); // Should remain unchanged
          });
        });

        describe('Delete Operations', () => {
          it('should delete a single record', async () => {
            // First delete dependent records to avoid foreign key constraint issues
            // Delete posts created by user 1
            try {
              const userPosts = await provider.getList({
                resource: 'posts',
                filters: [{ field: 'userId', operator: 'eq', value: 1 }],
              });

              for (const post of userPosts.data) {
                await provider.deleteOne({ resource: 'posts', id: post.id });
              }

              // Delete comments by user 1
              const userComments = await provider.getList({
                resource: 'comments',
                filters: [{ field: 'userId', operator: 'eq', value: 1 }],
              });

              for (const comment of userComments.data) {
                await provider.deleteOne({
                  resource: 'comments',
                  id: comment.id,
                });
              }
            } catch (error) {
              // Dependencies might not exist, that's ok
            }

            const result = await provider.deleteOne({
              resource: 'users',
              id: 1,
            });

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(1);

            // Verify the record is actually deleted
            await expect(
              provider.getOne({ resource: 'users', id: 1 })
            ).rejects.toThrow();
          });

          it('should delete multiple records', async () => {
            // First delete dependent records to avoid foreign key constraint issues
            try {
              const userPosts = await provider.getList({
                resource: 'posts',
                filters: [{ field: 'userId', operator: 'in', value: [1, 2] }],
              });

              for (const post of userPosts.data) {
                await provider.deleteOne({ resource: 'posts', id: post.id });
              }

              // Delete comments by users 1 and 2
              const userComments = await provider.getList({
                resource: 'comments',
                filters: [{ field: 'userId', operator: 'in', value: [1, 2] }],
              });

              for (const comment of userComments.data) {
                await provider.deleteOne({
                  resource: 'comments',
                  id: comment.id,
                });
              }
            } catch (error) {
              // Dependencies might not exist, that's ok
            }

            const result = await provider.deleteMany({
              resource: 'users',
              ids: [1, 2],
            });

            expect(result.data).toHaveLength(2);

            // Verify the records are actually deleted
            const remainingUsers = await provider.getList({
              resource: 'users',
            });

            expect(remainingUsers.data.length).toBe(TEST_DATA.users.length - 2);
          });

          it('should handle deletion of non-existent record', async () => {
            await expect(
              provider.deleteOne({ resource: 'users', id: 999999 })
            ).rejects.toThrow();
          });
        });
      });

      describe('Advanced Query Operations', () => {
        describe('Filtering', () => {
          it('should filter records with equality operator', async () => {
            const filters: CrudFilters = [
              { field: 'name', operator: 'eq', value: TEST_DATA.users[0].name },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            expect(result.data).toHaveLength(1);
            expect(result.data[0].name).toBe(TEST_DATA.users[0].name);
          });

          it('should filter records with comparison operators', async () => {
            const filters: CrudFilters = [
              { field: 'age', operator: 'gte', value: 30 },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            result.data.forEach(user => {
              expect(user.age).toBeGreaterThanOrEqual(30);
            });
          });

          it('should filter records with IN operator', async () => {
            const filters: CrudFilters = [
              { field: 'id', operator: 'in', value: [1, 2] },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            expect(result.data).toHaveLength(2);
            expect(result.data.map(u => u.id).sort()).toEqual([1, 2]);
          });

          it('should filter records with LIKE operator', async () => {
            const filters: CrudFilters = [
              { field: 'email', operator: 'contains', value: 'example.com' },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            result.data.forEach(user => {
              expect(user.email).toContain('example.com');
            });
          });

          it('should handle multiple filters with AND logic', async () => {
            const filters: CrudFilters = [
              { field: 'age', operator: 'gte', value: 25 },
              { field: 'isActive', operator: 'eq', value: true },
            ];

            const result = await provider.getList({
              resource: 'users',
              filters,
            });

            result.data.forEach(user => {
              expect(user.age).toBeGreaterThanOrEqual(25);
              expect(user.isActive).toBe(true);
            });
          });
        });

        describe('Sorting', () => {
          it('should sort records in ascending order', async () => {
            const sorters: CrudSorting = [{ field: 'age', order: 'asc' }];

            const result = await provider.getList({
              resource: 'users',
              sorters,
            });

            for (let i = 1; i < result.data.length; i++) {
              expect(result.data[i].age).toBeGreaterThanOrEqual(
                result.data[i - 1].age
              );
            }
          });

          it('should sort records in descending order', async () => {
            const sorters: CrudSorting = [{ field: 'age', order: 'desc' }];

            const result = await provider.getList({
              resource: 'users',
              sorters,
            });

            for (let i = 1; i < result.data.length; i++) {
              expect(result.data[i].age).toBeLessThanOrEqual(
                result.data[i - 1].age
              );
            }
          });

          it('should handle multiple sort fields', async () => {
            const sorters: CrudSorting = [
              { field: 'isActive', order: 'desc' },
              { field: 'age', order: 'asc' },
            ];

            const result = await provider.getList({
              resource: 'users',
              sorters,
            });

            // Should sort by isActive desc first, then by age asc
            expect(result.data.length).toBeGreaterThan(0);
          });
        });

        describe('Pagination', () => {
          it('should paginate results correctly', async () => {
            const pagination: Pagination = { currentPage: 1, pageSize: 2 };

            const result = await provider.getList({
              resource: 'users',
              pagination,
            });

            expect(result.data.length).toBeLessThanOrEqual(2);
            expect(result.total).toBeGreaterThanOrEqual(result.data.length);
          });

          it('should handle different page sizes', async () => {
            const smallPage = await provider.getList({
              resource: 'users',
              pagination: { current: 1, pageSize: 1 },
            });

            const largePage = await provider.getList({
              resource: 'users',
              pagination: { current: 1, pageSize: 10 },
            });

            expect(smallPage.data.length).toBeLessThanOrEqual(1);
            expect(largePage.data.length).toBeGreaterThanOrEqual(
              smallPage.data.length
            );
            expect(smallPage.total).toBe(largePage.total);
          });

          it('should handle page navigation', async () => {
            const page1 = await provider.getList({
              resource: 'users',
              pagination: { current: 1, pageSize: 1 },
            });

            const page2 = await provider.getList({
              resource: 'users',
              pagination: { current: 2, pageSize: 1 },
            });

            if (page1.total > 1) {
              // When there are multiple users, pages should have different data
              expect(page1.data[0].id).not.toBe(page2.data[0]?.id);
            } else {
              // When there's only 1 user, page 2 should be empty
              expect(page2.data.length).toBe(0);
            }
          });
        });

        describe('Combined Operations', () => {
          it('should handle filtering, sorting, and pagination together', async () => {
            const result = await provider.getList({
              resource: 'users',
              filters: [{ field: 'isActive', operator: 'eq', value: true }],
              sorters: [{ field: 'age', order: 'desc' }],
              pagination: { current: 1, pageSize: 2 },
            });

            expect(result.data.length).toBeLessThanOrEqual(2);
            result.data.forEach(user => {
              expect(user.isActive).toBe(true);
            });

            // Check sorting
            for (let i = 1; i < result.data.length; i++) {
              expect(result.data[i].age).toBeLessThanOrEqual(
                result.data[i - 1].age
              );
            }
          });
        });
      });

      describe('Error Handling', () => {
        it('should handle database connection errors gracefully', async () => {
          // This test would require simulating connection loss
          // For now, we'll test that the provider handles errors properly
          await expect(
            provider.getOne({ resource: 'nonexistent_table', id: 1 })
          ).rejects.toThrow();
        });

        it('should handle constraint violations', async () => {
          // Try to create a user with duplicate email
          const userData = {
            name: 'Duplicate User',
            email: TEST_DATA.users[0].email, // This should already exist
            age: 25,
          };

          await expect(
            provider.create({ resource: 'users', variables: userData })
          ).rejects.toThrow();
        });

        it('should handle invalid data types', async () => {
          // Try to create a user with null for a non-null field
          const invalidData = {
            name: null, // Should be a string and notNull
            email: 'test@example.com',
            age: 25,
          };

          await expect(
            provider.create({ resource: 'users', variables: invalidData })
          ).rejects.toThrow();
        });
      });

      describe('Performance Tests', () => {
        it('should handle bulk operations efficiently', async () => {
          const bulkData = Array.from({ length: 100 }, (_, i) => ({
            name: `Bulk User ${i}`,
            email: `bulk${i}@example.com`,
            age: 20 + (i % 50),
          }));

          const startTime = Date.now();
          const result = await provider.createMany({
            resource: 'users',
            variables: bulkData,
          });
          const duration = Date.now() - startTime;

          expect(result.data).toHaveLength(100);
          expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should handle large result sets efficiently', async () => {
          // First create a large dataset
          const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
            name: `User ${i}`,
            email: `user${i}@large.com`,
            age: 20 + (i % 60),
          }));

          await provider.createMany({
            resource: 'users',
            variables: largeDataset,
          });

          const startTime = Date.now();
          const result = await provider.getList({
            resource: 'users',
            pagination: { current: 1, pageSize: 100 },
          });
          const duration = Date.now() - startTime;

          expect(result.data).toHaveLength(100);
          expect(result.total).toBeGreaterThanOrEqual(1000);
          expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        });
      });
    }
  );
});
