import { expect, beforeEach, afterEach, describe, it } from 'vitest';
import createRefineSQL from '../src/data-provider';
import type { SqlClient } from '../src/client';

/**
 * Generic integration test suite that can be used with any SQL client
 */
export function createIntegrationTestSuite(
  clientName: string,
  createClient: () => Promise<SqlClient>,
  closeClient?: (client: SqlClient) => void | Promise<void>
) {
  return () => {
    let client: SqlClient;

    beforeEach(async () => {
      client = await createClient();
      
      // Create test table
      await client.execute({
        sql: `CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE,
          age INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        args: []
      });
    });

    afterEach(async () => {
      if (closeClient) {
        await closeClient(client);
      }
    });

    describe(`${clientName} Adapter Tests`, () => {
      it('should execute INSERT operations', async () => {
        const result = await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['John Doe', 'john@example.com', 30]
        });

        expect(result.changes).toBe(1);
        expect(result.lastInsertId).toBe(1);
      });

      it('should query data correctly', async () => {
        // Insert test data
        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['Alice Smith', 'alice@example.com', 25]
        });

        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['Bob Johnson', 'bob@example.com', 35]
        });

        // Query the data
        const result = await client.query({
          sql: 'SELECT id, name, email, age FROM users ORDER BY age',
          args: []
        });

        expect(result.columnNames).toEqual(['id', 'name', 'email', 'age']);
        expect(result.rows).toHaveLength(2);
        expect(result.rows[0]).toEqual([1, 'Alice Smith', 'alice@example.com', 25]);
        expect(result.rows[1]).toEqual([2, 'Bob Johnson', 'bob@example.com', 35]);
      });

      it('should handle UPDATE operations', async () => {
        // Insert a user first
        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['Original Name', 'original@example.com', 25]
        });

        // Update the user
        const updateResult = await client.execute({
          sql: 'UPDATE users SET name = ?, age = ? WHERE id = ?',
          args: ['Updated Name', 26, 1]
        });

        expect(updateResult.changes).toBe(1);

        // Verify the update
        const queryResult = await client.query({
          sql: 'SELECT name, age FROM users WHERE id = ?',
          args: [1]
        });

        expect(queryResult.rows[0]).toEqual(['Updated Name', 26]);
      });

      it('should handle DELETE operations', async () => {
        // Insert test users
        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['User 1', 'user1@example.com', 25]
        });

        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['User 2', 'user2@example.com', 30]
        });

        // Delete one user
        const deleteResult = await client.execute({
          sql: 'DELETE FROM users WHERE id = ?',
          args: [1]
        });

        expect(deleteResult.changes).toBe(1);

        // Verify only one user remains
        const queryResult = await client.query({
          sql: 'SELECT COUNT(*) as count FROM users',
          args: []
        });

        expect(queryResult.rows[0][0]).toBe(1);
      });

      it('should handle transactions', async () => {
        if (!client.transaction) {
          return; // Skip if transaction is not supported
        }

        const result = await client.transaction!(async (tx) => {
          const user1 = await tx.execute({
            sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
            args: ['Transaction User 1', 'tx1@example.com', 28]
          });

          const user2 = await tx.execute({
            sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
            args: ['Transaction User 2', 'tx2@example.com', 32]
          });

          return { user1: user1.lastInsertId, user2: user2.lastInsertId };
        });

        expect(result.user1).toBe(1);
        expect(result.user2).toBe(2);

        // Verify both users were inserted
        const queryResult = await client.query({
          sql: 'SELECT COUNT(*) as count FROM users',
          args: []
        });

        expect(queryResult.rows[0][0]).toBe(2);
      });

      it('should rollback failed transactions', async () => {
        if (!client.transaction) {
          return; // Skip if transaction is not supported
        }

        await expect(
          client.transaction!(async (tx) => {
            await tx.execute({
              sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
              args: ['Valid User', 'valid@example.com', 25]
            });

            // This should fail due to duplicate email
            await tx.execute({
              sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
              args: ['Invalid User', 'valid@example.com', 30]
            });
          })
        ).rejects.toThrow();

        // Verify no users were inserted
        const queryResult = await client.query({
          sql: 'SELECT COUNT(*) as count FROM users',
          args: []
        });

        expect(queryResult.rows[0][0]).toBe(0);
      });
    });

    describe(`${clientName} Data Provider Integration Tests`, () => {
      let dataProvider: any;

      beforeEach(() => {
        dataProvider = createRefineSQL(client);
      });

      it('should create and retrieve a record', async () => {
        const createResult = await dataProvider.create({
          resource: 'users',
          variables: {
            name: 'Data Provider User',
            email: 'dp@example.com',
            age: 27
          }
        });

        expect(createResult.data).toMatchObject({
          id: 1,
          name: 'Data Provider User',
          email: 'dp@example.com',
          age: 27
        });

        // Retrieve the record
        const getResult = await dataProvider.getOne({
          resource: 'users',
          id: 1
        });

        expect(getResult.data).toMatchObject({
          id: 1,
          name: 'Data Provider User',
          email: 'dp@example.com',
          age: 27
        });
      });

      it('should handle getList with pagination and filtering', async () => {
        // Create test data
        for (let i = 1; i <= 15; i++) {
          await dataProvider.create({
            resource: 'users',
            variables: {
              name: `User ${i}`,
              email: `user${i}@example.com`,
              age: 20 + i
            }
          });
        }

        // Test pagination
        const listResult = await dataProvider.getList({
          resource: 'users',
          pagination: { current: 2, pageSize: 5 },
          sorters: [{ field: 'id', order: 'asc' }]
        });

        expect(listResult.total).toBe(15);
        expect(listResult.data).toHaveLength(5);
        expect(listResult.data[0].id).toBe(6);
        expect(listResult.data[4].id).toBe(10);

        // Test filtering
        const filteredResult = await dataProvider.getList({
          resource: 'users',
          filters: [
            { field: 'age', operator: 'gte', value: 30 }
          ]
        });

        expect(filteredResult.data.length).toBeGreaterThan(0);
        expect(filteredResult.data.every((user: any) => user.age >= 30)).toBe(true);
      });

      it('should handle createMany with transactions', async () => {
        const users = [
          { name: 'Batch User 1', email: 'batch1@example.com', age: 25 },
          { name: 'Batch User 2', email: 'batch2@example.com', age: 30 },
          { name: 'Batch User 3', email: 'batch3@example.com', age: 35 }
        ];

        const createManyResult = await dataProvider.createMany({
          resource: 'users',
          variables: users
        });

        expect(createManyResult.data).toHaveLength(3);
        expect(createManyResult.data[0]).toMatchObject({
          id: 1,
          name: 'Batch User 1',
          email: 'batch1@example.com',
          age: 25
        });
      });

      it('should handle update operations', async () => {
        // Create a user first
        const createResult = await dataProvider.create({
          resource: 'users',
          variables: {
            name: 'Original User',
            email: 'original@example.com',
            age: 25
          }
        });

        // Update the user
        const updateResult = await dataProvider.update({
          resource: 'users',
          id: createResult.data.id,
          variables: {
            name: 'Updated User',
            age: 26
          }
        });

        expect(updateResult.data).toMatchObject({
          id: createResult.data.id,
          name: 'Updated User',
          email: 'original@example.com', // Should remain unchanged
          age: 26
        });
      });

      it('should handle delete operations', async () => {
        // Create test users
        const user1 = await dataProvider.create({
          resource: 'users',
          variables: { name: 'User 1', email: 'user1@example.com', age: 25 }
        });

        const user2 = await dataProvider.create({
          resource: 'users',
          variables: { name: 'User 2', email: 'user2@example.com', age: 30 }
        });

        // Delete one user
        const deleteResult = await dataProvider.deleteOne({
          resource: 'users',
          id: user1.data.id
        });

        expect(deleteResult.data).toMatchObject({
          id: user1.data.id,
          name: 'User 1',
          email: 'user1@example.com'
        });

        // Verify user was deleted
        const listResult = await dataProvider.getList({
          resource: 'users'
        });

        expect(listResult.data).toHaveLength(1);
        expect(listResult.data[0].id).toBe(user2.data.id);
      });

      it('should handle complex filtering and sorting', async () => {
        // Create diverse test data
        const users = [
          { name: 'Alice Johnson', email: 'alice.j@example.com', age: 28 },
          { name: 'Bob Smith', email: 'bob.s@example.com', age: 32 },
          { name: 'Charlie Brown', email: 'charlie.b@example.com', age: 25 },
          { name: 'Diana Wilson', email: 'diana.w@example.com', age: 29 },
          { name: 'Alice Williams', email: 'alice.w@example.com', age: 31 }
        ];

        for (const user of users) {
          await dataProvider.create({
            resource: 'users',
            variables: user
          });
        }

        // Test name filtering with contains
        const nameFilterResult = await dataProvider.getList({
          resource: 'users',
          filters: [
            { field: 'name', operator: 'contains', value: 'Alice' }
          ],
          sorters: [{ field: 'age', order: 'asc' }]
        });

        expect(nameFilterResult.data).toHaveLength(2);
        expect(nameFilterResult.data[0].name).toBe('Alice Johnson');
        expect(nameFilterResult.data[1].name).toBe('Alice Williams');

        // Test age range filtering
        const ageRangeResult = await dataProvider.getList({
          resource: 'users',
          filters: [
            { field: 'age', operator: 'gte', value: 30 }
          ],
          sorters: [{ field: 'name', order: 'asc' }]
        });

        expect(ageRangeResult.data.length).toBeGreaterThanOrEqual(2);
        expect(ageRangeResult.data.every((user: any) => user.age >= 30)).toBe(true);
      });
    });

    describe(`${clientName} Error Handling`, () => {
      let dataProvider: any;

      beforeEach(() => {
        dataProvider = createRefineSQL(client);
      });

      it('should handle database constraint violations', async () => {
        // Insert a user
        await client.execute({
          sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
          args: ['First User', 'unique@example.com', 25]
        });

        // Try to insert another user with the same email
        await expect(
          client.execute({
            sql: 'INSERT INTO users (name, email, age) VALUES (?, ?, ?)',
            args: ['Second User', 'unique@example.com', 30]
          })
        ).rejects.toThrow();
      });

      it('should handle invalid SQL queries', async () => {
        await expect(
          client.query({
            sql: 'SELECT * FROM non_existent_table',
            args: []
          })
        ).rejects.toThrow();
      });

      it('should handle malformed SQL in data provider', async () => {
        await expect(
          dataProvider.getList({
            resource: 'invalid_table_name'
          })
        ).rejects.toThrow();
      });
    });
  };
}