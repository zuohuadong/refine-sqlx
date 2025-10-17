import { describe, expect, it, beforeEach } from '@jest/globals';
import { eq, sql } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';
import { AggregationsExecutor } from '../../src/features/aggregations/executor';
import type { AggregationsConfig } from '../../src/config';
import { describeIfBetterSqlite3Available } from '../helpers/better-sqlite3-check';

/**
 * Test schema for aggregations
 */
const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  customerId: integer('customer_id').notNull(),
  status: text('status').notNull(),
  amount: integer('amount').notNull(),
  region: text('region').notNull(),
});

const schema = { orders };

describeIfBetterSqlite3Available('Aggregations with HAVING clause', () => {
  let sqliteDb: Database.Database;
  let db: BetterSQLite3Database<typeof schema>;
  let executor: AggregationsExecutor;

  beforeEach(() => {
    // Create in-memory database
    sqliteDb = new Database(':memory:');
    db = drizzle(sqliteDb, { schema });

    // Create table
    sqliteDb.exec(`
      CREATE TABLE orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        status TEXT NOT NULL,
        amount INTEGER NOT NULL,
        region TEXT NOT NULL
      )
    `);

    // Insert test data
    sqliteDb.exec(`
      INSERT INTO orders (customer_id, status, amount, region) VALUES
        (1, 'completed', 100, 'US'),
        (1, 'completed', 200, 'US'),
        (1, 'pending', 150, 'US'),
        (2, 'completed', 300, 'EU'),
        (2, 'completed', 400, 'EU'),
        (2, 'completed', 500, 'EU'),
        (3, 'completed', 50, 'APAC'),
        (3, 'cancelled', 75, 'APAC'),
        (4, 'completed', 1000, 'US'),
        (5, 'completed', 250, 'EU')
    `);

    // Initialize executor
    const config: AggregationsConfig = {
      enabled: true,
      functions: ['count', 'sum', 'avg', 'min', 'max'],
      having: true,
    };
    executor = new AggregationsExecutor(db, schema, config);
  });

  describe('Basic HAVING conditions', () => {
    it('should filter by count > N', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        groupBy: ['customerId'],
        having: [{ field: 'total', operator: 'gt', value: 2 }],
      });

      // Only customer 2 has more than 2 orders (3 orders)
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        customerId: 2,
        total: 3,
        revenue: 1200,
      });
    });

    it('should filter by sum >= N', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        groupBy: ['customerId'],
        having: [{ field: 'revenue', operator: 'gte', value: 450 }],
      });

      // Customers with revenue >= 450: customer 1 (450), customer 2 (1200), customer 4 (1000)
      expect(result.data).toHaveLength(3);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([1, 2, 4]);
    });

    it('should filter by avg < N', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'avg', field: 'amount', alias: 'avgAmount' },
        ],
        groupBy: ['customerId'],
        having: [{ field: 'avgAmount', operator: 'lt', value: 100 }],
      });

      // Customer 3 has average amount = (50 + 75) / 2 = 62.5
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        customerId: 3,
        total: 2,
      });
      expect(result.data[0].avgAmount).toBeLessThan(100);
    });

    it('should filter by equal', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [{ type: 'count', alias: 'total' }],
        groupBy: ['customerId'],
        having: [{ field: 'total', operator: 'eq', value: 3 }],
      });

      // Only customer 2 has exactly 3 orders
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        customerId: 2,
        total: 3,
      });
    });

    it('should filter by not equal', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [{ type: 'count', alias: 'total' }],
        groupBy: ['customerId'],
        having: [{ field: 'total', operator: 'ne', value: 3 }],
      });

      // All customers except customer 2
      expect(result.data).toHaveLength(4);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([1, 3, 4, 5]);
    });
  });

  describe('HAVING with BETWEEN', () => {
    it('should filter by between values', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [{ type: 'sum', field: 'amount', alias: 'revenue' }],
        groupBy: ['customerId'],
        having: [{ field: 'revenue', operator: 'between', value: [200, 500] }],
      });

      // Customers with revenue between 200-500: customer 1 (450), customer 5 (250)
      expect(result.data).toHaveLength(2);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([1, 5]);
    });

    it('should filter by not between values', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [{ type: 'sum', field: 'amount', alias: 'revenue' }],
        groupBy: ['customerId'],
        having: [
          { field: 'revenue', operator: 'nbetween', value: [200, 500] },
        ],
      });

      // Customers with revenue NOT between 200-500: customer 2 (1200), customer 3 (125), customer 4 (1000)
      expect(result.data).toHaveLength(3);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([2, 3, 4]);
    });
  });

  describe('Multiple HAVING conditions (implicit AND)', () => {
    it('should apply multiple AND conditions', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        groupBy: ['customerId'],
        having: [
          { field: 'total', operator: 'gte', value: 2 },
          { field: 'revenue', operator: 'lte', value: 500 },
        ],
      });

      // Customers with >= 2 orders AND revenue <= 500: customer 1 (3 orders, 450), customer 3 (2 orders, 125)
      expect(result.data).toHaveLength(2);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([1, 3]);
    });
  });

  describe('Logical HAVING conditions (explicit OR)', () => {
    it('should apply OR conditions', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        groupBy: ['customerId'],
        having: [
          {
            operator: 'or',
            conditions: [
              { field: 'total', operator: 'eq', value: 1 },
              { field: 'revenue', operator: 'gte', value: 1000 },
            ],
          },
        ],
      });

      // Customers with 1 order OR revenue >= 1000: customer 4 (1 order, 1000), customer 5 (1 order, 250), customer 2 (3 orders, 1200)
      expect(result.data).toHaveLength(3);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([2, 4, 5]);
    });

    it('should apply nested AND/OR conditions', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        groupBy: ['customerId'],
        having: [
          {
            operator: 'or',
            conditions: [
              {
                operator: 'and',
                conditions: [
                  { field: 'total', operator: 'gte', value: 3 },
                  { field: 'revenue', operator: 'gt', value: 1000 },
                ],
              },
              { field: 'total', operator: 'eq', value: 1 },
            ],
          },
        ],
      });

      // Customers with (total >= 3 AND revenue > 1000) OR total = 1
      // customer 2 (3 orders, 1200) matches first condition
      // customer 4 (1 order, 1000) and customer 5 (1 order, 250) match second condition
      expect(result.data).toHaveLength(3);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([2, 4, 5]);
    });
  });

  describe('HAVING with WHERE filters', () => {
    it('should apply WHERE before GROUP BY and HAVING after', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
        groupBy: ['customerId'],
        having: [{ field: 'total', operator: 'gte', value: 2 }],
      });

      // Filter WHERE status = 'completed' first
      // Then GROUP BY customer_id
      // Then HAVING count >= 2
      // customer 1 (2 completed orders), customer 2 (3 completed orders)
      expect(result.data).toHaveLength(2);
      const customerIds = result.data.map((r: any) => r.customerId).sort();
      expect(customerIds).toEqual([1, 2]);
    });

    it('should group by multiple fields with HAVING', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'total' },
          { type: 'sum', field: 'amount', alias: 'revenue' },
        ],
        filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
        groupBy: ['region'],
        having: [{ field: 'revenue', operator: 'gte', value: 300 }],
      });

      // Group by region with revenue >= 300
      // US: 1100 (100 + 200 + 1000), EU: 1050 (300 + 400 + 500 + 250), APAC: 50
      expect(result.data).toHaveLength(2);
      const regions = result.data.map((r: any) => r.region).sort();
      expect(regions).toEqual(['EU', 'US']);
    });
  });

  describe('Error handling', () => {
    it('should throw error for unknown aggregate alias', async () => {
      await expect(
        executor.aggregate({
          resource: 'orders',
          functions: [{ type: 'count', alias: 'total' }],
          groupBy: ['customerId'],
          having: [{ field: 'unknown_alias', operator: 'gt', value: 10 }],
        }),
      ).rejects.toThrow(/unknown aggregate alias/i);
    });

    it('should throw error for invalid between operator', async () => {
      await expect(
        executor.aggregate({
          resource: 'orders',
          functions: [{ type: 'sum', field: 'amount', alias: 'revenue' }],
          groupBy: ['customerId'],
          having: [{ field: 'revenue', operator: 'between', value: [100] }], // Only 1 value instead of 2
        }),
      ).rejects.toThrow(/array of two values/i);
    });

    it('should handle empty HAVING array', async () => {
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [{ type: 'count', alias: 'total' }],
        groupBy: ['customerId'],
        having: [],
      });

      // Should return all groups when no HAVING conditions
      expect(result.data).toHaveLength(5);
    });
  });

  describe('Real-world scenarios', () => {
    it('should find high-value customers', async () => {
      // Find customers with average order value > 200
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'orderCount' },
          { type: 'avg', field: 'amount', alias: 'avgOrderValue' },
          { type: 'sum', field: 'amount', alias: 'totalRevenue' },
        ],
        filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
        groupBy: ['customerId'],
        having: [{ field: 'avgOrderValue', operator: 'gt', value: 200 }],
      });

      // customer 2: avg = 400, customer 4: avg = 1000
      expect(result.data).toHaveLength(2);
    });

    it('should find profitable regions', async () => {
      // Find regions with total revenue > 300 and at least 2 orders
      const result = await executor.aggregate({
        resource: 'orders',
        functions: [
          { type: 'count', alias: 'orderCount' },
          { type: 'sum', field: 'amount', alias: 'totalRevenue' },
        ],
        filters: [{ field: 'status', operator: 'eq', value: 'completed' }],
        groupBy: ['region'],
        having: [
          { field: 'totalRevenue', operator: 'gt', value: 300 },
          { field: 'orderCount', operator: 'gte', value: 2 },
        ],
      });

      // US: 3 orders, 1300 revenue; EU: 4 orders, 1450 revenue
      expect(result.data).toHaveLength(2);
      const regions = result.data.map((r: any) => r.region).sort();
      expect(regions).toEqual(['EU', 'US']);
    });
  });
});
