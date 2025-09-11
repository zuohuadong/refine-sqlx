import type { Table } from 'drizzle-orm';
import type { DrizzleClient } from '../types/client';
import type { TransactionOptions } from '../types/config';
import { TransactionError } from '../types/errors';

/**
 * Transaction context that provides the same interface as the main data provider
 * but operates within a transaction
 */
export interface TransactionContext<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  client: DrizzleClient<TSchema>;
  schema: TSchema;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

/**
 * Transaction manager for handling database transactions across different adapters
 */
export class TransactionManager<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  private activeTransactions = new Map<string, any>();
  private transactionCounter = 0;

  constructor(
    private client: DrizzleClient<TSchema>,
    private schema: TSchema,
    private adapterType: 'postgresql' | 'mysql' | 'sqlite'
  ) {}

  /**
   * Execute a function within a database transaction
   */
  async transaction<T>(
    fn: (tx: TransactionContext<TSchema>) => Promise<T>,
    options?: TransactionOptions
  ): Promise<T> {
    const transactionId = this.generateTransactionId();

    try {
      // Use drizzle's native transaction method directly
      return await (this.client as any).transaction(async (tx: any) => {
        // Store the transaction for tracking
        this.activeTransactions.set(transactionId, tx);

        // Set isolation level if specified
        if (options?.isolationLevel && this.adapterType !== 'sqlite') {
          const isolationLevel = this.mapIsolationLevel(options.isolationLevel);
          if (isolationLevel) {
            await tx.execute(
              `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`
            );
          }
        }

        // Set read-only mode if specified (PostgreSQL only)
        if (options?.readOnly && this.adapterType === 'postgresql') {
          await tx.execute('SET TRANSACTION READ ONLY');
        }

        // Create transaction context
        const txContext: TransactionContext<TSchema> = {
          client: tx,
          schema: this.schema,
          rollback: () => {
            throw new TransactionError('Transaction rolled back');
          },
          commit: () => Promise.resolve(), // Drizzle handles commit automatically
        };

        try {
          // Execute the transaction function
          const result = await fn(txContext);
          this.activeTransactions.delete(transactionId);
          return result;
        } catch (error) {
          this.activeTransactions.delete(transactionId);
          throw error;
        }
      });
    } catch (error) {
      // Clean up transaction tracking
      this.activeTransactions.delete(transactionId);

      // Handle TransactionError specially to preserve rollback semantics
      if (
        error instanceof TransactionError &&
        error.message === 'Transaction rolled back'
      ) {
        throw error;
      }

      throw new TransactionError(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        { transactionId }
      );
    }
  }

  /**
   * Map standard isolation levels to database-specific syntax
   */
  private mapIsolationLevel(level?: string): string | undefined {
    if (!level) return undefined;

    const mapping: Record<string, string> = {
      READ_UNCOMMITTED: 'READ UNCOMMITTED',
      READ_COMMITTED: 'READ COMMITTED',
      REPEATABLE_READ: 'REPEATABLE READ',
      SERIALIZABLE: 'SERIALIZABLE',
    };

    return mapping[level];
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${++this.transactionCounter}`;
  }

  /**
   * Get active transaction count
   */
  getActiveTransactionCount(): number {
    return this.activeTransactions.size;
  }

  /**
   * Check if a transaction is active
   */
  isTransactionActive(transactionId: string): boolean {
    return this.activeTransactions.has(transactionId);
  }

  /**
   * Get all active transaction IDs
   */
  getActiveTransactionIds(): string[] {
    return Array.from(this.activeTransactions.keys());
  }

  /**
   * Force rollback all active transactions (emergency cleanup)
   */
  async rollbackAllTransactions(): Promise<void> {
    const transactionIds = this.getActiveTransactionIds();

    // For drizzle transactions, we can't force rollback externally
    // Just clear the tracking and let transactions complete naturally
    this.activeTransactions.clear();

    if (transactionIds.length > 0) {
      console.warn(
        `Cleared tracking for ${transactionIds.length} active transactions. They will complete or fail naturally.`
      );
    }
  }
}
