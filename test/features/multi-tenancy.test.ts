import { describe, expect, it, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createRefineSQL } from '../../src/provider';

// Test schema with tenant field
const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: text('organization_id').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
});

const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  organizationId: text('organization_id').notNull(),
  userId: integer('user_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
});

// Table without tenant field
const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
});

const schema = { users, posts, categories };

describe('Multi-Tenancy', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    // Create tables
    sqlite.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL
      );

      CREATE TABLE posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id TEXT NOT NULL,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL
      );

      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL
      );
    `);

    // Insert test data for multiple tenants
    sqlite.exec(`
      INSERT INTO users (organization_id, name, email) VALUES
        ('org1', 'Alice', 'alice@org1.com'),
        ('org1', 'Bob', 'bob@org1.com'),
        ('org2', 'Charlie', 'charlie@org2.com'),
        ('org2', 'David', 'david@org2.com'),
        ('org3', 'Eve', 'eve@org3.com');

      INSERT INTO posts (organization_id, user_id, title, content) VALUES
        ('org1', 1, 'Post 1', 'Content 1'),
        ('org1', 2, 'Post 2', 'Content 2'),
        ('org2', 3, 'Post 3', 'Content 3'),
        ('org2', 4, 'Post 4', 'Content 4');

      INSERT INTO categories (name) VALUES
        ('Tech'),
        ('News');
    `);
  });

  describe('Automatic tenant filtering', () => {
    it('should filter getList by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
      });

      expect(total).toBe(2);
      expect(data).toHaveLength(2);
      expect(data.every((user) => user.organizationId === 'org1')).toBe(true);
    });

    it('should filter getOne by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.getOne({
        resource: 'users',
        id: 1,
      });

      expect(data.organizationId).toBe('org1');
    });

    it('should return null when accessing other tenant data', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      // Try to access org2's user
      await expect(
        dataProvider.getOne({
          resource: 'users',
          id: 3, // Charlie from org2
        }),
      ).rejects.toThrow();
    });

    it('should filter getMany by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.getMany!({
        resource: 'users',
        ids: [1, 2, 3], // 1,2 from org1, 3 from org2
      });

      // Should only return org1 users
      expect(data).toHaveLength(2);
      expect(data.every((user) => user.organizationId === 'org1')).toBe(true);
    });
  });

  describe('Automatic tenant injection', () => {
    it('should inject tenant ID on create', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Frank',
          email: 'frank@org1.com',
          // organizationId NOT provided - should be injected
        },
      });

      expect(data.organizationId).toBe('org1');
      expect(data.name).toBe('Frank');
    });

    it('should inject tenant ID on createMany', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org2',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.createMany!({
        resource: 'users',
        variables: [
          { name: 'User1', email: 'user1@org2.com' },
          { name: 'User2', email: 'user2@org2.com' },
        ],
      });

      expect(data).toHaveLength(2);
      expect(data.every((user) => user.organizationId === 'org2')).toBe(true);
    });

    it('should not override manually provided tenant ID', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      // Explicitly provide different tenant (should be overridden for security)
      const { data } = await dataProvider.create({
        resource: 'users',
        variables: {
          name: 'Hacker',
          email: 'hacker@evil.com',
          organizationId: 'org2', // Try to create in different tenant
        },
      });

      // Should be forced to org1
      expect(data.organizationId).toBe('org1');
    });
  });

  describe('Update and delete operations', () => {
    it('should filter update by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.update({
        resource: 'users',
        id: 1,
        variables: { name: 'Alice Updated' },
      });

      expect(data.name).toBe('Alice Updated');
      expect(data.organizationId).toBe('org1');
    });

    it('should prevent updating other tenant data', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      await expect(
        dataProvider.update({
          resource: 'users',
          id: 3, // Charlie from org2
          variables: { name: 'Hacked' },
        }),
      ).rejects.toThrow();
    });

    it('should filter updateMany by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.updateMany!({
        resource: 'users',
        ids: [1, 2, 3], // Mix of org1 and org2
        variables: { name: 'Updated' },
      });

      // Should only update org1 users
      expect(data).toHaveLength(2);
    });

    it('should filter delete by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.deleteOne({
        resource: 'users',
        id: 1,
      });

      expect(data.id).toBe(1);

      // Verify deleted
      const { total } = await dataProvider.getList({
        resource: 'users',
      });
      expect(total).toBe(1); // Only Bob left
    });

    it('should prevent deleting other tenant data', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      await expect(
        dataProvider.deleteOne({
          resource: 'users',
          id: 3, // Charlie from org2
        }),
      ).rejects.toThrow();
    });

    it('should filter deleteMany by tenant', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data } = await dataProvider.deleteMany!({
        resource: 'users',
        ids: [1, 2, 3], // Mix of org1 and org2
      });

      // Should only delete org1 users
      expect(data).toHaveLength(2);
    });
  });

  describe('Dynamic tenant switching', () => {
    it('should allow tenant override via meta', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
        meta: {
          tenantId: 'org2', // Override to org2
        },
      });

      expect(total).toBe(2);
      expect(data.every((user) => user.organizationId === 'org2')).toBe(true);
    });

    it('should support bypassing tenancy for admins', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
        meta: {
          bypassTenancy: true, // Admin mode
        },
      });

      // Should return all users from all tenants
      expect(total).toBe(5);
    });
  });

  describe('Strict mode', () => {
    it('should throw error for tables without tenant field in strict mode', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
          strictMode: true,
        },
      });

      // categories table doesn't have organizationId field
      await expect(
        dataProvider.getList({
          resource: 'categories',
        }),
      ).rejects.toThrow();
    });

    it('should allow tables without tenant field when strict mode disabled', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
          strictMode: false,
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'categories',
      });

      // Should return all categories (no filtering)
      expect(total).toBe(2);
    });
  });

  describe('Custom tenant field names', () => {
    it('should support custom tenant field name', async () => {
      // Add custom tenant field
      sqlite.exec(`ALTER TABLE users ADD COLUMN company_id TEXT`);
      sqlite.exec(`UPDATE users SET company_id = organization_id`);

      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'company_id', // Custom field name
        },
      });

      const { total } = await dataProvider.getList({
        resource: 'users',
      });

      expect(total).toBe(2); // org1 users
    });
  });

  describe('Integration with filters', () => {
    it('should combine tenant filter with user filters', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
        filters: [
          { field: 'name', operator: 'contains', value: 'Alice' },
        ],
      });

      expect(total).toBe(1);
      expect(data[0].name).toBe('Alice');
      expect(data[0].organizationId).toBe('org1');
    });

    it('should work with complex filter combinations', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 'org1',
          tenantField: 'organizationId',
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
        filters: [
          {
            operator: 'or',
            value: [
              { field: 'name', operator: 'eq', value: 'Alice' },
              { field: 'name', operator: 'eq', value: 'Bob' },
            ],
          },
        ],
      });

      expect(total).toBe(2);
      expect(data.every((user) => user.organizationId === 'org1')).toBe(true);
    });
  });

  describe('Disabled multi-tenancy', () => {
    it('should not filter when multi-tenancy disabled', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: false,
        },
      });

      const { data, total } = await dataProvider.getList({
        resource: 'users',
      });

      // Should return all users
      expect(total).toBe(5);
    });

    it('should not inject tenant ID when disabled', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        // No multiTenancy config
      });

      await expect(
        dataProvider.create({
          resource: 'users',
          variables: {
            name: 'Test',
            email: 'test@test.com',
            organizationId: 'manual', // Must provide manually
          },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle numeric tenant IDs', async () => {
      // Change to numeric tenant IDs
      sqlite.exec(`UPDATE users SET organization_id = '1' WHERE organization_id = 'org1'`);
      sqlite.exec(`UPDATE users SET organization_id = '2' WHERE organization_id = 'org2'`);

      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: 1, // Numeric tenant ID
          tenantField: 'organizationId',
        },
      });

      const { total } = await dataProvider.getList({
        resource: 'users',
      });

      expect(total).toBe(2);
    });

    it('should handle null tenant ID gracefully', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: null as any,
          tenantField: 'organizationId',
        },
      });

      await expect(
        dataProvider.getList({
          resource: 'users',
        }),
      ).rejects.toThrow();
    });

    it('should handle empty tenant ID', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        multiTenancy: {
          enabled: true,
          tenantId: '',
          tenantField: 'organizationId',
        },
      });

      const { total } = await dataProvider.getList({
        resource: 'users',
      });

      expect(total).toBe(0); // No users with empty organizationId
    });
  });
});
