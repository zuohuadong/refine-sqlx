/**
 * Transaction functionality integration tests
 * Tests transaction management across all supported databases
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
} from '../test-utils.js';
import {
  DatabaseTestSetup,
  skipIfDatabaseNotAvailable,
  TEST_DATA,
  isTestEnvironmentReady,
} from './database-setup';
import type { RefineOrmDataProvider } from '../../types/client';

const testSetup = new DatabaseTestSetup();

// Test databases to run against - filter based on environment
const ALL_TEST_DATABASES = [
  { type: 'sqlite', name: 'SQLite' },
  { type: 'postgresql', name: 'PostgreSQL' },
  { type: 'mysql', name: 'MySQL' },
] as const;

const TEST_DATABASES = ALL_TEST_DATABASES.filter(db => {
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
});

// Run transaction tests for each database type
TEST_DATABASES.forEach(({ type: dbType, name: dbName }) => {
  describe.skipIf(skipIfDatabaseNotAvailable(dbType))(
    `${dbName} Transaction Integration`,
    () => {
      let provider: RefineOrmDataProvider<any>;

      beforeAll(async () => {
        try {
          provider = await testSetup.setupDatabase(dbType);
        } catch (error) {
          console.warn(
            `Skipping ${dbName} transaction tests due to setup failure:`,
            error
          );
          throw error;
        }
      });

      afterAll(async () => {
        await testSetup.teardownDatabase(dbType);
      });

      beforeEach(async () => {
        // Clean and reseed data before each test
        // Don't recreate the connection - just clean and reseed the data
        try {
          if (provider && provider.executeRaw) {
            // Clean tables in reverse order due to foreign keys
            if (dbType === 'mysql') {
              // For MySQL, disable foreign key checks temporarily
              await provider.executeRaw('SET FOREIGN_KEY_CHECKS = 0');
            }

            await provider.executeRaw('DELETE FROM comments');
            await provider.executeRaw('DELETE FROM posts');
            await provider.executeRaw('DELETE FROM users');

            // Reset sequences based on database type
            if (dbType === 'postgresql') {
              await provider.executeRaw(
                'ALTER SEQUENCE users_id_seq RESTART WITH 1'
              );
              await provider.executeRaw(
                'ALTER SEQUENCE posts_id_seq RESTART WITH 1'
              );
              await provider.executeRaw(
                'ALTER SEQUENCE comments_id_seq RESTART WITH 1'
              );
            } else if (dbType === 'mysql') {
              await provider.executeRaw('ALTER TABLE users AUTO_INCREMENT = 1');
              await provider.executeRaw('ALTER TABLE posts AUTO_INCREMENT = 1');
              await provider.executeRaw(
                'ALTER TABLE comments AUTO_INCREMENT = 1'
              );
              // Re-enable foreign key checks
              await provider.executeRaw('SET FOREIGN_KEY_CHECKS = 1');
            } else if (dbType === 'sqlite') {
              try {
                await provider.executeRaw(
                  'DELETE FROM sqlite_sequence WHERE name IN (?, ?, ?)',
                  ['users', 'posts', 'comments']
                );
              } catch (e) {
                // sqlite_sequence might not exist, that's ok
              }
            }

            // Re-seed test data
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
          }
        } catch (error) {
          console.warn(`Failed to reset database for ${dbName}:`, error);
        }
      });

      describe('Basic Transaction Operations', () => {
        it('should commit successful transactions', async () => {
          const initialUserCount = await provider.getList({
            resource: 'users',
          });

          const result = await provider.transaction(async tx => {
            // Create a user within transaction
            const user = await tx.create({
              resource: 'users',
              variables: {
                name: 'Transaction User',
                email: 'transaction@example.com',
                age: 30,
              },
            });

            // Create a post for that user
            const post = await tx.create({
              resource: 'posts',
              variables: {
                title: 'Transaction Post',
                content: 'Created within transaction',
                userId: user.data.id,
                published: true,
              },
            });

            return { user: user.data, post: post.data };
          });

          expect(result.user).toBeDefined();
          expect(result.post).toBeDefined();
          expect(result.post.userId).toBe(result.user.id);

          // Verify data was committed
          const finalUserCount = await provider.getList({ resource: 'users' });
          expect(finalUserCount.total).toBe(initialUserCount.total + 1);

          const createdUser = await provider.getOne({
            resource: 'users',
            id: result.user.id,
          });
          expect(createdUser.data.name).toBe('Transaction User');
        });

        it('should rollback failed transactions', async () => {
          const initialUserCount = await provider.getList({
            resource: 'users',
          });
          const initialPostCount = await provider.getList({
            resource: 'posts',
          });

          await expect(
            provider.transaction(async tx => {
              // Create a user within transaction
              const user = await tx.create({
                resource: 'users',
                variables: {
                  name: 'Rollback User',
                  email: 'rollback@example.com',
                  age: 25,
                },
              });

              // Create a post for that user
              await tx.create({
                resource: 'posts',
                variables: {
                  title: 'Rollback Post',
                  content: 'This should be rolled back',
                  userId: user.data.id,
                  published: true,
                },
              });

              // Intentionally cause an error to trigger rollback
              throw new Error('Intentional transaction failure');
            })
          ).rejects.toThrow('Intentional transaction failure');

          // Verify data was rolled back
          const finalUserCount = await provider.getList({ resource: 'users' });
          const finalPostCount = await provider.getList({ resource: 'posts' });

          expect(finalUserCount.total).toBe(initialUserCount.total);
          expect(finalPostCount.total).toBe(initialPostCount.total);
        });

        it('should handle nested transactions correctly', async () => {
          const result = await provider.transaction(async tx => {
            // Outer transaction: create user
            const user = await tx.create({
              resource: 'users',
              variables: {
                name: 'Nested Transaction User',
                email: 'nested@example.com',
                age: 28,
              },
            });

            // Inner transaction-like operation
            const posts = [];
            for (let i = 0; i < 3; i++) {
              const post = await tx.create({
                resource: 'posts',
                variables: {
                  title: `Nested Post ${i + 1}`,
                  content: `Content for nested post ${i + 1}`,
                  userId: user.data.id,
                  published: i % 2 === 0,
                },
              });
              posts.push(post.data);
            }

            return { user: user.data, posts };
          });

          expect(result.user).toBeDefined();
          expect(result.posts).toHaveLength(3);

          // Verify all data was committed
          const userPosts = await provider.getList({
            resource: 'posts',
            filters: [
              { field: 'userId', operator: 'eq', value: result.user.id },
            ],
          });

          expect(userPosts.data).toHaveLength(3);
        });
      });

      describe('Complex Transaction Scenarios', () => {
        it('should handle multiple table operations in single transaction', async () => {
          const result = await provider.transaction(async tx => {
            // Create multiple users
            const users = [];
            for (let i = 0; i < 3; i++) {
              const user = await tx.create({
                resource: 'users',
                variables: {
                  name: `Multi User ${i + 1}`,
                  email: `multi${i + 1}@example.com`,
                  age: 25 + i,
                },
              });
              users.push(user.data);
            }

            // Create posts for each user
            const posts = [];
            for (const user of users) {
              const post = await tx.create({
                resource: 'posts',
                variables: {
                  title: `Post by ${user.name}`,
                  content: `Content by user ${user.id}`,
                  userId: user.id,
                  published: true,
                },
              });
              posts.push(post.data);
            }

            // Create comments on posts
            const comments = [];
            for (let i = 0; i < posts.length; i++) {
              const comment = await tx.create({
                resource: 'comments',
                variables: {
                  content: `Comment on post ${posts[i].id}`,
                  commentableType: 'post',
                  commentableId: posts[i].id,
                  userId: users[(i + 1) % users.length].id, // Different user commenting
                },
              });
              comments.push(comment.data);
            }

            return { users, posts, comments };
          });

          expect(result.users).toHaveLength(3);
          expect(result.posts).toHaveLength(3);
          expect(result.comments).toHaveLength(3);

          // Verify relationships
          result.posts.forEach((post, index) => {
            expect(post.userId).toBe(result.users[index].id);
          });

          result.comments.forEach((comment, index) => {
            expect(comment.commentableId).toBe(result.posts[index].id);
            expect(comment.commentableType).toBe('post');
          });
        });

        it('should handle update operations in transactions', async () => {
          const initialUser = await provider.create({
            resource: 'users',
            variables: {
              name: 'Update Test User',
              email: 'update@example.com',
              age: 30,
              isActive: true,
            },
          });

          const result = await provider.transaction(async tx => {
            // Update user
            const updatedUser = await tx.update({
              resource: 'users',
              id: initialUser.data.id,
              variables: {
                name: 'Updated in Transaction',
                age: 31,
                isActive: false,
              },
            });

            // Create a post for the updated user
            const post = await tx.create({
              resource: 'posts',
              variables: {
                title: 'Post after update',
                content: 'Created after user update',
                userId: updatedUser.data.id,
                published: true,
              },
            });

            return { user: updatedUser.data, post: post.data };
          });

          expect(result.user.name).toBe('Updated in Transaction');
          expect(result.user.age).toBe(31);
          // MySQL returns 0/1 for TINYINT, SQLite/PostgreSQL return boolean
          expect(result.user.isActive).toBeFalsy(); // Accepts both false and 0
          expect(result.post.userId).toBe(result.user.id);

          // Verify changes were committed
          const verifyUser = await provider.getOne({
            resource: 'users',
            id: initialUser.data.id,
          });

          expect(verifyUser.data.name).toBe('Updated in Transaction');
          expect(verifyUser.data.age).toBe(31);
          expect(verifyUser.data.isActive).toBeFalsy(); // Accepts both false and 0
        });

        it('should handle delete operations in transactions', async () => {
          // Create test data
          const user = await provider.create({
            resource: 'users',
            variables: {
              name: 'Delete Test User',
              email: 'delete@example.com',
              age: 25,
            },
          });

          const post = await provider.create({
            resource: 'posts',
            variables: {
              title: 'Delete Test Post',
              content: 'This post will be deleted',
              userId: user.data.id,
              published: true,
            },
          });

          const result = await provider.transaction(async tx => {
            // Delete post first (to handle foreign key constraints)
            const deletedPost = await tx.deleteOne({
              resource: 'posts',
              id: post.data.id,
            });

            // Then delete user
            const deletedUser = await tx.deleteOne({
              resource: 'users',
              id: user.data.id,
            });

            return {
              deletedUser: deletedUser.data,
              deletedPost: deletedPost.data,
            };
          });

          expect(result.deletedUser.id).toBe(user.data.id);
          expect(result.deletedPost.id).toBe(post.data.id);

          // Verify deletions were committed
          await expect(
            provider.getOne({ resource: 'users', id: user.data.id })
          ).rejects.toThrow();

          await expect(
            provider.getOne({ resource: 'posts', id: post.data.id })
          ).rejects.toThrow();
        });
      });

      describe('Transaction Error Handling', () => {
        it('should rollback on constraint violations', async () => {
          const initialUserCount = await provider.getList({
            resource: 'users',
          });

          await expect(
            provider.transaction(async tx => {
              // Create first user successfully
              await tx.create({
                resource: 'users',
                variables: {
                  name: 'First User',
                  email: 'constraint@example.com',
                  age: 25,
                },
              });

              // Try to create second user with same email (should fail)
              await tx.create({
                resource: 'users',
                variables: {
                  name: 'Second User',
                  email: 'constraint@example.com', // Duplicate email
                  age: 30,
                },
              });
            })
          ).rejects.toThrow();

          // Verify no users were created
          const finalUserCount = await provider.getList({ resource: 'users' });
          expect(finalUserCount.total).toBe(initialUserCount.total);
        });

        it('should rollback on foreign key violations', async () => {
          const initialPostCount = await provider.getList({
            resource: 'posts',
          });

          await expect(
            provider.transaction(async tx => {
              // Try to create post with non-existent user ID
              await tx.create({
                resource: 'posts',
                variables: {
                  title: 'Invalid Post',
                  content: 'This should fail',
                  userId: 999999, // Non-existent user ID
                  published: true,
                },
              });
            })
          ).rejects.toThrow();

          // Verify no posts were created
          const finalPostCount = await provider.getList({ resource: 'posts' });
          expect(finalPostCount.total).toBe(initialPostCount.total);
        });

        it('should handle timeout scenarios gracefully', async () => {
          // This test simulates a long-running transaction
          const startTime = Date.now();

          await expect(
            provider.transaction(async tx => {
              // Create a user
              const user = await tx.create({
                resource: 'users',
                variables: {
                  name: 'Timeout User',
                  email: 'timeout@example.com',
                  age: 25,
                },
              });

              // Simulate a long operation that might timeout
              // In a real scenario, this could be a complex query or external API call
              await new Promise(resolve => setTimeout(resolve, 100));

              // Try to create many posts (might cause timeout in some databases)
              const posts = [];
              for (let i = 0; i < 10; i++) {
                const post = await tx.create({
                  resource: 'posts',
                  variables: {
                    title: `Timeout Post ${i}`,
                    content: `Content ${i}`,
                    userId: user.data.id,
                    published: true,
                  },
                });
                posts.push(post.data);
              }

              return { user: user.data, posts };
            })
          ).resolves.toBeDefined();

          const duration = Date.now() - startTime;
          expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
        });
      });

      describe('Transaction Isolation', () => {
        it('should maintain data consistency during concurrent operations', async () => {
          // Skip this test for SQLite as it doesn't support concurrent transactions
          if (dbName.toLowerCase().includes('sqlite')) {
            console.warn(
              'Skipping concurrent transaction test for SQLite - not supported'
            );
            return;
          }

          // Create initial user
          const user = await provider.create({
            resource: 'users',
            variables: {
              name: 'Concurrent User',
              email: 'concurrent@example.com',
              age: 30,
            },
          });

          // Run concurrent transactions
          const transaction1 = provider.transaction(async tx => {
            const updatedUser = await tx.update({
              resource: 'users',
              id: user.data.id,
              variables: { age: 31 },
            });

            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 50));

            return updatedUser.data;
          });

          const transaction2 = provider.transaction(async tx => {
            const post = await tx.create({
              resource: 'posts',
              variables: {
                title: 'Concurrent Post',
                content: 'Created concurrently',
                userId: user.data.id,
                published: true,
              },
            });

            return post.data;
          });

          const [result1, result2] = await Promise.all([
            transaction1,
            transaction2,
          ]);

          expect(result1.id).toBe(user.data.id);
          expect(result1.age).toBe(31);
          expect(result2.userId).toBe(user.data.id);

          // Verify final state
          const finalUser = await provider.getOne({
            resource: 'users',
            id: user.data.id,
          });
          expect(finalUser.data.age).toBe(31);

          const userPosts = await provider.getList({
            resource: 'posts',
            filters: [{ field: 'userId', operator: 'eq', value: user.data.id }],
          });
          expect(userPosts.data.length).toBeGreaterThan(0);
        });
      });

      describe('Transaction Performance', () => {
        it('should handle bulk operations efficiently in transactions', async () => {
          const startTime = Date.now();

          const result = await provider.transaction(async tx => {
            const users = [];
            const posts = [];

            // Create 50 users
            for (let i = 0; i < 50; i++) {
              const user = await tx.create({
                resource: 'users',
                variables: {
                  name: `Bulk User ${i}`,
                  email: `bulk${i}@example.com`,
                  age: 20 + (i % 50),
                },
              });
              users.push(user.data);
            }

            // Create 2 posts per user
            for (const user of users) {
              for (let j = 0; j < 2; j++) {
                const post = await tx.create({
                  resource: 'posts',
                  variables: {
                    title: `Post ${j + 1} by ${user.name}`,
                    content: `Content for post ${j + 1}`,
                    userId: user.id,
                    published: j === 0,
                  },
                });
                posts.push(post.data);
              }
            }

            return { users, posts };
          });

          const duration = Date.now() - startTime;

          expect(result.users).toHaveLength(50);
          expect(result.posts).toHaveLength(100);
          expect(duration).toBeLessThan(15000); // Should complete within 15 seconds

          // Verify data was committed
          const finalUserCount = await provider.getList({ resource: 'users' });
          const finalPostCount = await provider.getList({ resource: 'posts' });

          expect(finalUserCount.total).toBeGreaterThanOrEqual(50);
          expect(finalPostCount.total).toBeGreaterThanOrEqual(100);
        });
      });
    }
  );
});
