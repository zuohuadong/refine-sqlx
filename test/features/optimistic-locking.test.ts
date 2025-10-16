import { describe, expect, it, beforeEach } from '@jest/globals';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createRefineSQL } from '../../src/provider';
import { OptimisticLockError } from '../../src/errors';

// Test schema with version field
const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  version: integer('version').notNull().default(1),
});

// Test schema with timestamp field
const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productId: integer('product_id').notNull(),
  quantity: integer('quantity').notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

const schema = { products, orders };

describe('Optimistic Locking', () => {
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle>;

  beforeEach(() => {
    // Create in-memory database
    sqlite = new Database(':memory:');
    db = drizzle(sqlite, { schema });

    // Create tables
    sqlite.exec(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL,
        version INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // Insert test data
    sqlite.exec(`
      INSERT INTO products (name, price, version) VALUES
        ('Widget', 100, 1),
        ('Gadget', 200, 1),
        ('Tool', 150, 5);

      INSERT INTO orders (product_id, quantity, updated_at) VALUES
        (1, 10, ${Date.now() - 1000}),
        (2, 20, ${Date.now() - 2000});
    `);
  });

  describe('Version-based locking', () => {
    it('should successfully update with correct version', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
          versionField: 'version',
        },
      });

      const { data } = await dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 120 },
        meta: { version: 1 },
      });

      expect(data).toMatchObject({
        id: 1,
        name: 'Widget',
        price: 120,
        version: 2, // Version incremented
      });
    });

    it('should throw OptimisticLockError with incorrect version', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
          versionField: 'version',
        },
      });

      await expect(
        dataProvider.update({
          resource: 'products',
          id: 1,
          variables: { price: 120 },
          meta: { version: 99 }, // Wrong version
        }),
      ).rejects.toThrow(OptimisticLockError);
    });

    it('should include version info in error', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      try {
        await dataProvider.update({
          resource: 'products',
          id: 1,
          variables: { price: 120 },
          meta: { version: 99 },
        });
        fail('Should have thrown OptimisticLockError');
      } catch (error) {
        expect(error).toBeInstanceOf(OptimisticLockError);
        if (error instanceof OptimisticLockError) {
          expect(error.expectedVersion).toBe(99);
          expect(error.currentVersion).toBe(1);
        }
      }
    });

    it('should work with higher version numbers', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      const { data } = await dataProvider.update({
        resource: 'products',
        id: 3,
        variables: { price: 175 },
        meta: { version: 5 },
      });

      expect(data.version).toBe(6);
    });

    it('should require version in meta when locking enabled', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      await expect(
        dataProvider.update({
          resource: 'products',
          id: 1,
          variables: { price: 120 },
          // meta: { version: 1 }, // Missing version
        }),
      ).rejects.toThrow();
    });

    it('should work with updateMany', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      // Update multiple records
      const { data } = await dataProvider.updateMany({
        resource: 'products',
        ids: [1, 2],
        variables: { price: 999 },
        meta: {
          versions: { 1: 1, 2: 1 }, // Map of id -> version
        },
      });

      expect(data).toHaveLength(2);
      expect(data[0].version).toBe(2);
      expect(data[1].version).toBe(2);
    });

    it('should fail updateMany if any version mismatches', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      await expect(
        dataProvider.updateMany({
          resource: 'products',
          ids: [1, 2],
          variables: { price: 999 },
          meta: {
            versions: { 1: 1, 2: 99 }, // Wrong version for id 2
          },
        }),
      ).rejects.toThrow(OptimisticLockError);
    });
  });

  describe('Timestamp-based locking', () => {
    it('should successfully update with correct timestamp', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'timestamp',
          timestampField: 'updatedAt',
        },
      });

      // Get current order
      const { data: order } = await dataProvider.getOne({
        resource: 'orders',
        id: 1,
      });

      const originalTimestamp = order.updatedAt;

      // Update with correct timestamp
      const { data } = await dataProvider.update({
        resource: 'orders',
        id: 1,
        variables: { quantity: 15 },
        meta: { lastUpdated: originalTimestamp },
      });

      expect(data.quantity).toBe(15);
      expect(data.updatedAt.getTime()).toBeGreaterThan(
        originalTimestamp.getTime(),
      );
    });

    it('should throw OptimisticLockError with incorrect timestamp', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'timestamp',
          timestampField: 'updatedAt',
        },
      });

      const oldTimestamp = new Date(Date.now() - 10000);

      await expect(
        dataProvider.update({
          resource: 'orders',
          id: 1,
          variables: { quantity: 15 },
          meta: { lastUpdated: oldTimestamp },
        }),
      ).rejects.toThrow(OptimisticLockError);
    });

    it('should auto-update timestamp on successful update', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'timestamp',
        },
      });

      const before = Date.now();

      const { data: order } = await dataProvider.getOne({
        resource: 'orders',
        id: 1,
      });

      const { data } = await dataProvider.update({
        resource: 'orders',
        id: 1,
        variables: { quantity: 15 },
        meta: { lastUpdated: order.updatedAt },
      });

      const after = Date.now();

      expect(data.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(data.updatedAt.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('Disabled locking', () => {
    it('should work normally when locking disabled', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: false,
        },
      });

      // Should work without version
      const { data } = await dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 120 },
      });

      expect(data.price).toBe(120);
      // Version should still be in database but not enforced
      expect(data.version).toBe(1); // Not incremented
    });

    it('should not require version in meta', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        // No optimisticLocking config
      });

      await expect(
        dataProvider.update({
          resource: 'products',
          id: 1,
          variables: { price: 120 },
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle concurrent updates correctly', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      // Simulate concurrent updates
      const update1 = dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 110 },
        meta: { version: 1 },
      });

      // Second update with same version (should fail)
      const update2 = dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 130 },
        meta: { version: 1 },
      });

      // First should succeed
      await expect(update1).resolves.toBeDefined();

      // Second should fail
      await expect(update2).rejects.toThrow(OptimisticLockError);
    });

    it('should handle missing version field gracefully', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
          versionField: 'nonexistent',
        },
      });

      await expect(
        dataProvider.update({
          resource: 'products',
          id: 1,
          variables: { price: 120 },
          meta: { version: 1 },
        }),
      ).rejects.toThrow();
    });

    it('should work with zero version', async () => {
      // Insert record with version 0
      sqlite.exec(`INSERT INTO products (name, price, version) VALUES ('Test', 50, 0)`);

      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
      });

      const { data } = await dataProvider.update({
        resource: 'products',
        id: 4,
        variables: { price: 60 },
        meta: { version: 0 },
      });

      expect(data.version).toBe(1);
    });
  });

  describe('Integration with other features', () => {
    it('should work with multi-tenancy', async () => {
      // Add tenant_id to products
      sqlite.exec(`ALTER TABLE products ADD COLUMN tenant_id TEXT`);
      sqlite.exec(`UPDATE products SET tenant_id = 'tenant1'`);

      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
        multiTenancy: {
          enabled: true,
          tenantId: 'tenant1',
          tenantField: 'tenant_id',
        },
      });

      const { data } = await dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 120 },
        meta: { version: 1 },
      });

      expect(data.version).toBe(2);
    });

    it('should work with caching', async () => {
      const dataProvider = await createRefineSQL({
        connection: db,
        schema,
        optimisticLocking: {
          enabled: true,
          strategy: 'version',
        },
        cache: {
          enabled: true,
          adapter: 'memory',
        },
      });

      // First update
      await dataProvider.update({
        resource: 'products',
        id: 1,
        variables: { price: 120 },
        meta: { version: 1 },
      });

      // Cache should be invalidated, second read should get fresh data
      const { data } = await dataProvider.getOne({
        resource: 'products',
        id: 1,
      });

      expect(data.version).toBe(2);
      expect(data.price).toBe(120);
    });
  });
});
