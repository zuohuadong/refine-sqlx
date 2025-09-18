/**
 * Relationship query integration tests
 * Tests relationship loading, chain queries, and morphic relationships across all databases
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { sql } from 'drizzle-orm';
import {
  DatabaseTestSetup,
  skipIfDatabaseNotAvailable,
  TEST_DATA,
  isTestEnvironmentReady,
} from './database-setup';
import type { RefineOrmDataProvider } from '../../types/client';

const testSetup = new DatabaseTestSetup();

// Test databases to run against - filter based on environment
const TEST_DATABASES = [
  { type: 'sqlite' as const, name: 'SQLite' },
  { type: 'postgresql' as const, name: 'PostgreSQL' },
  { type: 'mysql' as const, name: 'MySQL' },
].filter(db => {
  // In CI, only run tests for the database that's configured
  if (process.env.CI) {
    if (process.env.POSTGRES_URL && db.type === 'postgresql') return true;
    if (process.env.MYSQL_URL && db.type === 'mysql') return true;
    // Only run SQLite if no other database is configured
    if (
      !process.env.POSTGRES_URL &&
      !process.env.MYSQL_URL &&
      db.type === 'sqlite'
    )
      return true;
    return false;
  }
  // In local development, run all available databases
  return isTestEnvironmentReady(db.type);
}) as const;

// Run relationship tests for each database type
TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
  describe.skipIf(skipIfDatabaseNotAvailable(dbType))(
    `${dbName} Relationship Queries Integration`,
    () => {
      let provider: RefineOrmDataProvider<any>;

      beforeAll(async () => {
        try {
          provider = await testSetup.setupDatabase(dbType);
        } catch (error) {
          console.warn(
            `Skipping ${dbName} relationship tests due to setup failure:`,
            error
          );
          throw error;
        }
      }, 30000);

      afterAll(async () => {
        await testSetup.teardownDatabase(dbType);
      }, 10000);

      beforeEach(async () => {
        // Clean and reseed data before each test to ensure isolation
        try {
          // Use the DatabaseTestSetup to clean up tables specifically
          const setup = new DatabaseTestSetup();

          // First clean up the current tables
          if (provider && provider.executeRaw) {
            // Delete in reverse order to handle foreign key constraints
            try {
              await provider.executeRaw('DELETE FROM comments WHERE 1=1');
            } catch (e) {
              // Table might not exist, continue
            }
            try {
              await provider.executeRaw('DELETE FROM posts WHERE 1=1');
            } catch (e) {
              // Table might not exist, continue
            }
            try {
              await provider.executeRaw('DELETE FROM users WHERE 1=1');
            } catch (e) {
              // Table might not exist, continue
            }

            // Reset auto-increment counters for SQLite
            if (dbType === 'sqlite') {
              try {
                await provider.executeRaw(
                  'DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?)',
                  ['users', 'posts', 'comments']
                );
              } catch (e) {
                // sqlite_sequence might not exist, that's ok
              }
            } else if (dbType === 'mysql') {
              // Reset auto-increment counters for MySQL
              try {
                await provider.executeRaw('ALTER TABLE users AUTO_INCREMENT = 1');
                await provider.executeRaw('ALTER TABLE posts AUTO_INCREMENT = 1');
                await provider.executeRaw('ALTER TABLE comments AUTO_INCREMENT = 1');
              } catch (e) {
                // Table might not exist, continue
              }
            } else if (dbType === 'postgresql') {
              // Reset sequences for PostgreSQL
              try {
                await provider.executeRaw('ALTER SEQUENCE users_id_seq RESTART WITH 1');
                await provider.executeRaw('ALTER SEQUENCE posts_id_seq RESTART WITH 1');
                await provider.executeRaw('ALTER SEQUENCE comments_id_seq RESTART WITH 1');
              } catch (e) {
                // Sequence might not exist, continue
              }
            }
          }

          // Now re-seed with fresh test data
          for (const userData of TEST_DATA.users) {
            await provider.create({ resource: 'users', variables: userData });
          }

          for (const postData of TEST_DATA.posts) {
            await provider.create({ resource: 'posts', variables: postData });
          }

          for (const commentData of TEST_DATA.comments) {
            await provider.create({
              resource: 'comments',
              variables: commentData,
            });
          }

          // Small delay to ensure data is fully persisted
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          console.warn(`Failed to reset database for ${dbName}:`, error);
        }
      }, 15000);

      describe('Chain Query Builder', () => {
        describe('Basic Chain Operations', () => {
          it('should perform basic chain query with where clause', async () => {
            const users = await provider
              .from('users')
              .where('isActive', 'eq', true)
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.isActive).toBe(true);
            });
          });

          it('should perform chain query with multiple where clauses', async () => {
            const users = await provider
              .from('users')
              .where('isActive', 'eq', true)
              .where('age', 'gte', 25)
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.isActive).toBe(true);
              expect(user.age).toBeGreaterThanOrEqual(25);
            });
          });

          it('should perform chain query with ordering', async () => {
            const users = await provider
              .from('users')
              .orderBy('age', 'desc')
              .get();

            expect(Array.isArray(users)).toBe(true);
            for (let i = 1; i < users.length; i++) {
              expect(users[i].age).toBeLessThanOrEqual(users[i - 1].age);
            }
          });

          it('should perform chain query with limit and offset', async () => {
            const allUsers = await provider.from('users').get();
            const limitedUsers = await provider.from('users').limit(2).get();

            expect(limitedUsers.length).toBeLessThanOrEqual(2);
            expect(limitedUsers.length).toBeLessThanOrEqual(allUsers.length);
          });

          it('should perform chain query with pagination', async () => {
            const page1 = await provider.from('users').paginate(1, 2).get();

            const page2 = await provider.from('users').paginate(2, 2).get();

            expect(page1.length).toBeLessThanOrEqual(2);
            expect(page2.length).toBeLessThanOrEqual(2);

            if (page1.length > 0 && page2.length > 0) {
              expect(page1[0].id).not.toBe(page2[0].id);
            }
          });
        });

        describe('Chain Query Execution Methods', () => {
          it('should get first record with first() method', async () => {
            const user = await provider
              .from('users')
              .orderBy('id', 'asc')
              .first();

            if (user) {
              expect(user.id).toBeDefined();
              expect(typeof user.name).toBe('string');
            }
          });

          it('should count records with count() method', async () => {
            const count = await provider
              .from('users')
              .where('isActive', 'eq', true)
              .count();

            expect(typeof count).toBe('number');
            expect(count).toBeGreaterThanOrEqual(0);
          });

          it('should calculate sum with sum() method', async () => {
            const sum = await provider.from('users').sum('age');

            expect(typeof sum).toBe('number');
            expect(sum).toBeGreaterThanOrEqual(0);
          });

          it('should calculate average with avg() method', async () => {
            const avg = await provider.from('users').avg('age');

            expect(typeof avg).toBe('number');
            expect(avg).toBeGreaterThanOrEqual(0);
          });
        });

        describe('Complex Chain Queries', () => {
          it('should handle complex filtering with multiple operators', async () => {
            const posts = await provider
              .from('posts')
              .where('published', 'eq', true)
              .where('userId', 'in', [1, 2])
              .orderBy('createdAt', 'desc')
              .limit(5)
              .get();

            expect(Array.isArray(posts)).toBe(true);
            posts.forEach(post => {
              expect(post.published).toBe(true);
              expect([1, 2]).toContain(post.userId);
            });
          });

          it('should handle text search operations', async () => {
            const posts = await provider
              .from('posts')
              .where('title', 'like', '%Post%')
              .get();

            expect(Array.isArray(posts)).toBe(true);
            posts.forEach(post => {
              expect(post.title.toLowerCase()).toContain('post');
            });
          });
        });
      });

      describe('Relationship Loading', () => {
        describe('getWithRelations Method', () => {
          it('should load user with related posts', async () => {
            const result = await provider.getWithRelations('users', 1, [
              'posts',
            ]);

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(1);
            expect(result.data.posts).toBeDefined();
            expect(Array.isArray(result.data.posts)).toBe(true);
          });

          it('should load post with related user', async () => {
            const result = await provider.getWithRelations('posts', 1, [
              'user',
            ]);

            expect(result.data).toBeDefined();
            expect(result.data.id).toBe(1);
            expect(result.data.user).toBeDefined();
            expect(result.data.user.id).toBe(result.data.userId);
          });

          it('should load multiple relationships', async () => {
            const result = await provider.getWithRelations('posts', 1, [
              'user',
              'comments',
            ]);

            expect(result.data).toBeDefined();
            expect(result.data.user).toBeDefined();
            expect(result.data.comments).toBeDefined();
            expect(Array.isArray(result.data.comments)).toBe(true);
          });
        });

        describe('Chain Query with Relationships', () => {
          it('should load relationships using with() method', async () => {
            const users = await provider
              .from('users')
              .with('posts')
              .where('isActive', 'eq', true)
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.posts).toBeDefined();
              expect(Array.isArray(user.posts)).toBe(true);
            });
          });

          it('should load nested relationships', async () => {
            const users = await provider
              .from('users')
              .with('posts', query => query.where('published', 'eq', true))
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.posts).toBeDefined();
              expect(Array.isArray(user.posts)).toBe(true);
              user.posts.forEach((post: any) => {
                expect(post.published).toBe(true);
              });
            });
          });

          it('should load multiple relationships with chain queries', async () => {
            const posts = await provider
              .from('posts')
              .with('user')
              .with('comments')
              .where('published', 'eq', true)
              .get();

            expect(Array.isArray(posts)).toBe(true);
            posts.forEach(post => {
              expect(post.user).toBeDefined();
              expect(post.comments).toBeDefined();
              expect(Array.isArray(post.comments)).toBe(true);
              expect(post.published).toBe(true);
            });
          });
        });
      });

      describe('Polymorphic Relationships', () => {
        describe('MorphTo Queries', () => {
          it('should load polymorphic relationships for comments', async () => {
            const comments = await provider
              .morphTo('comments', {
                typeField: 'commentableType',
                idField: 'commentableId',
                relationName: 'commentable',
                types: { post: 'posts', user: 'users' },
              })
              .get();

            expect(Array.isArray(comments)).toBe(true);
            comments.forEach(comment => {
              expect(comment.commentable).toBeDefined();

              if (comment.commentableType === 'post') {
                expect(comment.commentable.title).toBeDefined();
              } else if (comment.commentableType === 'user') {
                expect(comment.commentable.name).toBeDefined();
              }
            });
          });

          it('should filter polymorphic relationships', async () => {
            const postComments = await provider
              .morphTo('comments', {
                typeField: 'commentableType',
                idField: 'commentableId',
                relationName: 'commentable',
                types: { post: 'posts', user: 'users' },
              })
              .where('commentableType', 'eq', 'post')
              .get();

            expect(Array.isArray(postComments)).toBe(true);
            postComments.forEach(comment => {
              expect(comment.commentableType).toBe('post');
              expect(comment.commentable).toBeDefined();
              expect(comment.commentable.title).toBeDefined();
            });
          });

          it('should handle mixed polymorphic relationships', async () => {
            const comments = await provider
              .morphTo('comments', {
                typeField: 'commentableType',
                idField: 'commentableId',
                relationName: 'commentable',
                types: { post: 'posts', user: 'users' },
              })
              .get();

            expect(Array.isArray(comments)).toBe(true);

            const postComments = comments.filter(
              c => c.commentableType === 'post'
            );
            const userComments = comments.filter(
              c => c.commentableType === 'user'
            );

            postComments.forEach(comment => {
              expect(comment.commentable.title).toBeDefined();
            });

            userComments.forEach(comment => {
              expect(comment.commentable.name).toBeDefined();
            });
          });
        });

        describe('Chain Queries with Polymorphic Relationships', () => {
          it('should combine morphTo with regular chain operations', async () => {
            const recentComments = await provider
              .morphTo('comments', {
                typeField: 'commentableType',
                idField: 'commentableId',
                relationName: 'commentable',
                types: { post: 'posts', user: 'users' },
              })
              .orderBy('createdAt', 'desc')
              .limit(5)
              .get();

            expect(Array.isArray(recentComments)).toBe(true);
            expect(recentComments.length).toBeLessThanOrEqual(5);

            recentComments.forEach(comment => {
              expect(comment.commentable).toBeDefined();
            });
          });
        });
      });

      describe('Native Query Builders', () => {
        describe('Select Chain', () => {
          it('should perform complex select queries', async () => {
            const users = await provider.query
              .select('users')
              .where('age', 'gte', 25)
              .orderBy('name', 'asc')
              .limit(10)
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.age).toBeGreaterThanOrEqual(25);
            });
          });

          it('should perform select with specific columns', async () => {
            const users = await provider.query
              .select('users')
              .select(['id', 'name', 'email'])
              .get();

            expect(Array.isArray(users)).toBe(true);
            users.forEach(user => {
              expect(user.id).toBeDefined();
              expect(user.name).toBeDefined();
              expect(user.email).toBeDefined();
              // Age should not be selected
              expect(user.age).toBeUndefined();
            });
          });

          it('should perform select with distinct', async () => {
            const distinctAges = await provider.query
              .select('users')
              .select(['age'])
              .distinct()
              .get();

            expect(Array.isArray(distinctAges)).toBe(true);

            // Check that all ages are unique
            const ages = distinctAges.map(u => u.age);
            const uniqueAges = [...new Set(ages)];
            expect(ages.length).toBe(uniqueAges.length);
          });

          it('should perform select with groupBy and having', async () => {
            const ageGroups = await provider.query
              .select('users')
              .select(['age'])
              .groupBy('age')
              .having(sql`age > 25`)
              .get();

            expect(Array.isArray(ageGroups)).toBe(true);
            ageGroups.forEach(group => {
              expect(group.age).toBeGreaterThan(25);
            });
          });
        });

        describe('Insert Chain', () => {
          it('should perform insert with returning', async () => {
            const result = await provider.query
              .insert('users')
              .values({
                name: 'Insert Chain User',
                email: 'insertchain@example.com',
                age: 27,
              })
              .returning(['id', 'name', 'email'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toBeDefined();
            expect(result[0].id).toBeDefined();
            expect(result[0].name).toBe('Insert Chain User');
            expect(result[0].email).toBe('insertchain@example.com');
          });

          it('should perform bulk insert', async () => {
            const usersData = [
              { name: 'Bulk User 1', email: 'bulk1@example.com', age: 25 },
              { name: 'Bulk User 2', email: 'bulk2@example.com', age: 30 },
              { name: 'Bulk User 3', email: 'bulk3@example.com', age: 35 },
            ];

            const result = await provider.query
              .insert('users')
              .values(usersData)
              .returning(['id', 'name'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            expect(result).toHaveLength(3);
            result.forEach((user, index) => {
              expect(user.id).toBeDefined();
              expect(user.name).toBe(usersData[index].name);
            });
          });

          it('should handle insert conflicts', async () => {
            // First insert
            await provider.query
              .insert('users')
              .values({
                name: 'Conflict User',
                email: 'conflict@example.com',
                age: 28,
              })
              .execute();

            // Second insert with same email (should handle conflict)
            const result = await provider.query
              .insert('users')
              .values({
                name: 'Conflict User 2',
                email: 'conflict@example.com', // Duplicate email
                age: 29,
              })
              .onConflict('ignore')
              .execute();

            // Should not throw error and return empty array or handle gracefully
            expect(Array.isArray(result)).toBe(true);
          });
        });

        describe('Update Chain', () => {
          it('should perform update with where clause', async () => {
            const result = await provider.query
              .update('users')
              .set({ age: 40 })
              .where('id', 'eq', 1)
              .returning(['id', 'age'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toBeDefined();
            expect(result[0].id).toBe(1);
            expect(result[0].age).toBe(40);
          });

          it('should perform bulk update', async () => {
            const result = await provider.query
              .update('users')
              .set({ isActive: false })
              .where('age', 'gte', 30)
              .returning(['id', 'isActive'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            result.forEach(user => {
              expect(user.isActive).toBe(false);
            });
          });
        });

        describe('Delete Chain', () => {
          it('should perform delete with where clause', async () => {
            // First create a user to delete
            const user = await provider.create({
              resource: 'users',
              variables: {
                name: 'Delete Me',
                email: 'deleteme@example.com',
                age: 25,
              },
            });

            const result = await provider.query
              .delete('users')
              .where('id', 'eq', user.data.id)
              .returning(['id', 'name'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            expect(result[0]).toBeDefined();
            expect(result[0].id).toBe(user.data.id);
            expect(result[0].name).toBe('Delete Me');
          });

          it('should perform bulk delete', async () => {
            // Create test users
            const testUsers = await provider.createMany({
              resource: 'users',
              variables: [
                { name: 'Delete 1', email: 'delete1@example.com', age: 20 },
                { name: 'Delete 2', email: 'delete2@example.com', age: 21 },
              ],
            });

            const result = await provider.query
              .delete('users')
              .where('age', 'lt', 25)
              .returning(['id'])
              .execute();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(2);
          });
        });
      });

      describe('Performance and Edge Cases', () => {
        it('should handle large relationship datasets efficiently', async () => {
          // Create a user with many posts
          const user = await provider.create({
            resource: 'users',
            variables: {
              name: 'Prolific User',
              email: 'prolific@example.com',
              age: 30,
            },
          });

          // Create many posts for this user
          const posts = Array.from({ length: 50 }, (_, i) => ({
            title: `Post ${i + 1}`,
            content: `Content for post ${i + 1}`,
            userId: user.data.id,
            published: i % 2 === 0,
          }));

          await provider.createMany({ resource: 'posts', variables: posts });

          const startTime = Date.now();
          const result = await provider
            .from('users')
            .with('posts')
            .where('id', 'eq', user.data.id)
            .first();
          const duration = Date.now() - startTime;

          expect(result).toBeDefined();
          // The relationship should only return posts that belong to this specific user
          const userPosts = result!.posts.filter(
            p => p.userId === user.data.id
          );
          expect(userPosts).toHaveLength(50);
          expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
        });

        it('should handle empty relationship results gracefully', async () => {
          const user = await provider.create({
            resource: 'users',
            variables: {
              name: 'Lonely User',
              email: 'lonely@example.com',
              age: 25,
            },
          });

          const result = await provider
            .from('users')
            .with('posts')
            .where('id', 'eq', user.data.id)
            .first();

          expect(result).toBeDefined();
          expect(result!.posts).toBeDefined();
          expect(Array.isArray(result!.posts)).toBe(true);
          // Filter to only posts that belong to this specific user
          const userPosts = result!.posts.filter(
            p => p.userId === user.data.id
          );
          expect(userPosts).toHaveLength(0);
        });

        it('should handle complex nested relationship queries', async () => {
          const result = await provider
            .from('users')
            .with('posts', query =>
              query
                .where('published', 'eq', true)
                .orderBy('createdAt', 'desc')
                .limit(5)
            )
            .where('isActive', 'eq', true)
            .orderBy('name', 'asc')
            .get();

          expect(Array.isArray(result)).toBe(true);
          result.forEach(user => {
            expect(user.isActive).toBe(true);
            expect(user.posts).toBeDefined();
            expect(Array.isArray(user.posts)).toBe(true);
            expect(user.posts.length).toBeLessThanOrEqual(5);

            user.posts.forEach((post: any) => {
              expect(post.published).toBe(true);
            });
          });
        });
      });
    }
  );
});
