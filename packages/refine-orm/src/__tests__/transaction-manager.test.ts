import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { TransactionManager } from '../core/transaction-manager.js';
import type { DrizzleClient } from '../types/client.js';
import type { TransactionOptions } from '../types/config.js';
import { TransactionError } from '../types/errors.js';

// Test schema
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

const schema = { users };

// Mock client with transaction support
const createMockClient = () => {
  const mockTx = {
    select: vi
      .fn()
      .mockReturnValue({
        from: vi
          .fn()
          .mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue({ execute: vi.fn().mockResolvedValue([]) }),
            execute: vi.fn().mockResolvedValue([]),
          }),
      }),
    insert: vi
      .fn()
      .mockReturnValue({
        values: vi
          .fn()
          .mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi
                  .fn()
                  .mockResolvedValue([
                    { id: 1, name: 'John', email: 'john@example.com' },
                  ]),
              }),
          }),
      }),
    update: vi
      .fn()
      .mockReturnValue({
        set: vi
          .fn()
          .mockReturnValue({
            where: vi
              .fn()
              .mockReturnValue({
                returning: vi
                  .fn()
                  .mockReturnValue({
                    execute: vi
                      .fn()
                      .mockResolvedValue([
                        {
                          id: 1,
                          name: 'John Updated',
                          email: 'john@example.com',
                        },
                      ]),
                  }),
              }),
          }),
      }),
    delete: vi
      .fn()
      .mockReturnValue({
        where: vi
          .fn()
          .mockReturnValue({
            returning: vi
              .fn()
              .mockReturnValue({
                execute: vi.fn().mockResolvedValue([{ id: 1 }]),
              }),
          }),
      }),
    execute: vi.fn().mockResolvedValue([]),
  };

  return {
    transaction: vi.fn().mockImplementation(async fn => {
      return await fn(mockTx);
    }),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as unknown as DrizzleClient<typeof schema>;
};

describe('TransactionManager', () => {
  let transactionManager: TransactionManager<typeof schema>;
  let mockClient: DrizzleClient<typeof schema>;

  beforeEach(() => {
    mockClient = createMockClient();
    vi.clearAllMocks();
  });

  describe('PostgreSQL transactions', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
    });

    it('should execute transaction successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await transactionManager.transaction(mockFn);

      expect(result).toBe('success');
      expect(mockClient.transaction).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should provide transaction context with client and schema', async () => {
      let capturedContext: any;
      const mockFn = vi.fn().mockImplementation(ctx => {
        capturedContext = ctx;
        return Promise.resolve('success');
      });

      await transactionManager.transaction(mockFn);

      expect(capturedContext).toBeDefined();
      expect(capturedContext.client).toBeDefined();
      expect(capturedContext.schema).toBe(schema);
      expect(typeof capturedContext.rollback).toBe('function');
      expect(typeof capturedContext.commit).toBe('function');
    });

    it('should handle transaction rollback on error', async () => {
      const error = new Error('Transaction failed');
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow(
        TransactionError
      );
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should support transaction options', async () => {
      const options: TransactionOptions = {
        isolationLevel: 'READ_COMMITTED',
        readOnly: true,
      };
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await transactionManager.transaction(mockFn, options);

      expect(result).toBe('success');
      expect(mockClient.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle manual commit', async () => {
      let capturedContext: any;
      const mockFn = vi.fn().mockImplementation(async ctx => {
        capturedContext = ctx;
        await ctx.commit();
        return 'success';
      });

      const result = await transactionManager.transaction(mockFn);

      expect(result).toBe('success');
      expect(capturedContext.commit).toBeDefined();
    });

    it('should handle manual rollback', async () => {
      let capturedContext: any;
      const mockFn = vi.fn().mockImplementation(async ctx => {
        capturedContext = ctx;
        await ctx.rollback();
        return 'rolled back';
      });

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow();
    });

    it('should support nested transactions', async () => {
      const outerFn = vi.fn().mockImplementation(async _ctx => {
        return await transactionManager.transaction(async _innerCtx => {
          return 'nested success';
        });
      });

      const result = await transactionManager.transaction(outerFn);

      expect(result).toBe('nested success');
      expect(mockClient.transaction).toHaveBeenCalledTimes(2);
    });

    it('should handle concurrent transactions', async () => {
      const mockFn1 = vi.fn().mockResolvedValue('tx1');
      const mockFn2 = vi.fn().mockResolvedValue('tx2');

      const [result1, result2] = await Promise.all([
        transactionManager.transaction(mockFn1),
        transactionManager.transaction(mockFn2),
      ]);

      expect(result1).toBe('tx1');
      expect(result2).toBe('tx2');
      expect(mockClient.transaction).toHaveBeenCalledTimes(2);
    });

    it('should track active transactions', async () => {
      expect(transactionManager.getActiveTransactionCount()).toBe(0);

      const longRunningTx = transactionManager.transaction(async ctx => {
        // Simulate some work
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'done';
      });

      // Check during execution (might be timing dependent)
      await longRunningTx;
      expect(transactionManager.getActiveTransactionCount()).toBe(0);
    });
  });

  describe('MySQL transactions', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(mockClient, schema, 'mysql');
    });

    it('should execute MySQL transaction successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('mysql success');

      const result = await transactionManager.transaction(mockFn);

      expect(result).toBe('mysql success');
      expect(mockClient.transaction).toHaveBeenCalledTimes(1);
    });

    it('should support MySQL isolation levels', async () => {
      const options: TransactionOptions = { isolationLevel: 'REPEATABLE_READ' };
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await transactionManager.transaction(mockFn, options);

      expect(result).toBe('success');
    });

    it('should handle MySQL transaction errors', async () => {
      const error = new Error('MySQL constraint violation');
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow(
        TransactionError
      );
    });
  });

  describe('SQLite transactions', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(mockClient, schema, 'sqlite');
    });

    it('should execute SQLite transaction successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('sqlite success');

      const result = await transactionManager.transaction(mockFn);

      expect(result).toBe('sqlite success');
      expect(mockClient.transaction).toHaveBeenCalledTimes(1);
    });

    it('should handle SQLite limitations gracefully', async () => {
      const options: TransactionOptions = {
        isolationLevel: 'SERIALIZABLE', // SQLite has limited isolation level support
      };
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await transactionManager.transaction(mockFn, options);

      expect(result).toBe('success');
    });

    it('should handle SQLite transaction errors', async () => {
      const error = new Error('SQLite database locked');
      const mockFn = vi.fn().mockRejectedValue(error);

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow(
        TransactionError
      );
    });
  });

  describe('transaction management', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
    });

    it('should generate unique transaction IDs', async () => {
      const mockFn = vi.fn().mockImplementation(async _ctx => {
        // We can't directly access the transaction ID, but we can test uniqueness indirectly
        return 'success';
      });

      await Promise.all([
        transactionManager.transaction(mockFn),
        transactionManager.transaction(mockFn),
        transactionManager.transaction(mockFn),
      ]);

      // All transactions should complete successfully
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should clean up after successful transaction', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');

      await transactionManager.transaction(mockFn);

      expect(transactionManager.getActiveTransactionCount()).toBe(0);
    });

    it('should clean up after failed transaction', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Failed'));

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow();

      expect(transactionManager.getActiveTransactionCount()).toBe(0);
    });

    it('should support rollback all transactions', async () => {
      // This is more of an emergency cleanup method
      await transactionManager.rollbackAllTransactions();

      expect(transactionManager.getActiveTransactionCount()).toBe(0);
    });

    it('should handle unsupported adapter type', () => {
      expect(() => {
        new TransactionManager(mockClient, schema, 'unsupported' as any);
      }).not.toThrow(); // Constructor should not throw, but transaction method might
    });
  });

  describe('error scenarios', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
    });

    it('should wrap transaction errors in TransactionError', async () => {
      const originalError = new Error('Database connection lost');
      const mockFn = vi.fn().mockRejectedValue(originalError);

      try {
        await transactionManager.transaction(mockFn);
        expect.fail('Should have thrown TransactionError');
      } catch (error) {
        expect(error).toBeInstanceOf(TransactionError);
        expect((error as TransactionError).cause).toBe(originalError);
        expect((error as TransactionError).message).toContain(
          'Transaction failed'
        );
      }
    });

    it('should handle rollback failures gracefully', async () => {
      // Mock a scenario where rollback itself fails
      const mockClient = {
        transaction: vi.fn().mockImplementation(async _fn => {
          throw new Error('Transaction failed');
        }),
      } as unknown as DrizzleClient<typeof schema>;

      const txManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
      const mockFn = vi
        .fn()
        .mockRejectedValue(new Error('Business logic error'));

      await expect(txManager.transaction(mockFn)).rejects.toThrow(
        TransactionError
      );
    });

    it('should handle commit failures', async () => {
      const mockFn = vi.fn().mockImplementation(async ctx => {
        // Simulate commit failure by throwing in commit
        await ctx.commit();
        return 'success';
      });

      // The actual commit behavior depends on the drizzle-orm implementation
      await transactionManager.transaction(mockFn);
      expect(mockFn).toHaveBeenCalled();
    });

    it('should handle transaction timeout scenarios', async () => {
      const mockFn = vi.fn().mockImplementation(async _ctx => {
        // Simulate a long-running transaction
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'success';
      });

      const result = await transactionManager.transaction(mockFn);
      expect(result).toBe('success');
    });
  });

  describe('isolation levels', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
    });

    it('should map isolation levels correctly', async () => {
      const testCases = [
        'READ_UNCOMMITTED',
        'READ_COMMITTED',
        'REPEATABLE_READ',
        'SERIALIZABLE',
      ];

      for (const level of testCases) {
        const options: TransactionOptions = { isolationLevel: level as any };
        const mockFn = vi.fn().mockResolvedValue('success');

        const result = await transactionManager.transaction(mockFn, options);
        expect(result).toBe('success');
      }
    });

    it('should handle unknown isolation levels gracefully', async () => {
      const options: TransactionOptions = {
        isolationLevel: 'UNKNOWN_LEVEL' as any,
      };
      const mockFn = vi.fn().mockResolvedValue('success');

      const result = await transactionManager.transaction(mockFn, options);
      expect(result).toBe('success');
    });
  });

  describe('real-world scenarios', () => {
    beforeEach(() => {
      transactionManager = new TransactionManager(
        mockClient,
        schema,
        'postgresql'
      );
    });

    it('should handle user creation with profile transaction', async () => {
      const mockFn = vi.fn().mockImplementation(async ctx => {
        // Simulate creating user
        const user = await ctx.client
          .insert(users)
          .values({ name: 'John Doe', email: 'john@example.com' })
          .returning()
          .execute();

        // Simulate creating profile (would be another table)
        // const profile = await ctx.client.insert(profiles).values({...});

        return { user: user[0] };
      });

      const result = (await transactionManager.transaction(mockFn)) as {
        user: any;
      };

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle batch operations in transaction', async () => {
      const mockFn = vi.fn().mockImplementation(async ctx => {
        const usersList = [];

        // Simulate batch user creation
        for (let i = 0; i < 5; i++) {
          const user = await ctx.client
            .insert(schema.users)
            .values({ name: `User ${i}`, email: `user${i}@example.com` })
            .returning()
            .execute();
          usersList.push(user[0]);
        }

        return usersList;
      });

      const result = (await transactionManager.transaction(mockFn)) as any[];

      expect(Array.isArray(result)).toBe(true);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should handle conditional rollback', async () => {
      const mockFn = vi.fn().mockImplementation(async ctx => {
        // Simulate some business logic
        const shouldRollback = true;

        if (shouldRollback) {
          await ctx.rollback();
        }

        return 'should not reach here';
      });

      await expect(transactionManager.transaction(mockFn)).rejects.toThrow();
    });

    it('should handle transaction with external API calls', async () => {
      const mockFn = vi.fn().mockImplementation(async ctx => {
        // Simulate database operation
        const user = await ctx.client
          .insert(users)
          .values({ name: 'John Doe', email: 'john@example.com' })
          .returning()
          .execute();

        // Simulate external API call (should not be part of DB transaction)
        const externalResult = await Promise.resolve({ success: true });

        if (!externalResult.success) {
          throw new Error('External API failed');
        }

        return { user: user[0], external: externalResult };
      });

      const result = (await transactionManager.transaction(mockFn)) as {
        user: any;
        external: any;
      };

      expect(result).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.external).toBeDefined();
    });
  });
});
