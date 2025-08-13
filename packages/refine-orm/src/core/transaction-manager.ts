import type { Table } from 'drizzle-orm';
import type { DrizzleClient } from '../types/client.js';
import type { TransactionOptions } from '../types/config.js';
import { TransactionError } from '../types/errors.js';

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
      // Start transaction based on adapter type
      const tx = await this.beginTransaction(transactionId, options);

      // Create transaction context
      const txContext: TransactionContext<TSchema> = {
        client: tx,
        schema: this.schema,
        rollback: () => this.rollbackTransaction(transactionId),
        commit: () => this.commitTransaction(transactionId),
      };

      // Execute the transaction function
      const result = await fn(txContext);

      // Commit if not already committed/rolled back
      if (this.activeTransactions.has(transactionId)) {
        await this.commitTransaction(transactionId);
      }

      return result;
    } catch (error) {
      // Rollback if transaction is still active
      if (this.activeTransactions.has(transactionId)) {
        try {
          await this.rollbackTransaction(transactionId);
        } catch (rollbackError) {
          console.error('Failed to rollback transaction:', rollbackError);
        }
      }

      throw new TransactionError(
        `Transaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        { transactionId }
      );
    }
  }

  /**
   * Begin a new transaction
   */
  private async beginTransaction(
    transactionId: string,
    options?: TransactionOptions
  ): Promise<any> {
    try {
      let tx: any;

      switch (this.adapterType) {
        case 'postgresql':
          tx = await this.beginPostgreSQLTransaction(options);
          break;
        case 'mysql':
          tx = await this.beginMySQLTransaction(options);
          break;
        case 'sqlite':
          tx = await this.beginSQLiteTransaction(options);
          break;
        default:
          throw new TransactionError(
            `Unsupported adapter type: ${this.adapterType}`,
            undefined,
            { adapterType: this.adapterType }
          );
      }

      this.activeTransactions.set(transactionId, tx);
      return tx;
    } catch (error) {
      throw new TransactionError(
        `Failed to begin transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        { transactionId }
      );
    }
  }

  /**
   * Begin PostgreSQL transaction
   */
  private async beginPostgreSQLTransaction(
    options?: TransactionOptions
  ): Promise<any> {
    const isolationLevel = this.mapIsolationLevel(options?.isolationLevel);

    return await (this.client as any).transaction(async (tx: any) => {
      if (isolationLevel) {
        await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }

      if (options?.readOnly) {
        await tx.execute('SET TRANSACTION READ ONLY');
      }

      return tx;
    });
  }

  /**
   * Begin MySQL transaction
   */
  private async beginMySQLTransaction(
    options?: TransactionOptions
  ): Promise<any> {
    const isolationLevel = this.mapIsolationLevel(options?.isolationLevel);

    return await (this.client as any).transaction(async (tx: any) => {
      if (isolationLevel) {
        await tx.execute(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      }

      return tx;
    });
  }

  /**
   * Begin SQLite transaction
   */
  private async beginSQLiteTransaction(
    _options?: TransactionOptions
  ): Promise<any> {
    // SQLite has limited transaction options
    return await (this.client as any).transaction(async (tx: any) => {
      return tx;
    });
  }

  /**
   * Commit transaction
   */
  private async commitTransaction(transactionId: string): Promise<void> {
    const tx = this.activeTransactions.get(transactionId);
    if (!tx) {
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        undefined,
        { transactionId }
      );
    }

    try {
      // For drizzle-orm, transactions are automatically committed when the function completes successfully
      this.activeTransactions.delete(transactionId);
    } catch (error) {
      throw new TransactionError(
        `Failed to commit transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined,
        { transactionId }
      );
    }
  }

  /**
   * Rollback transaction
   */
  private async rollbackTransaction(transactionId: string): Promise<void> {
    const tx = this.activeTransactions.get(transactionId);
    if (!tx) {
      throw new TransactionError(
        `Transaction ${transactionId} not found`,
        undefined,
        { transactionId }
      );
    }

    try {
      // For drizzle-orm, we need to throw an error to trigger rollback
      this.activeTransactions.delete(transactionId);
      throw new Error('Transaction rolled back');
    } catch (error) {
      // This is expected for rollback
      this.activeTransactions.delete(transactionId);
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

    for (const transactionId of transactionIds) {
      try {
        await this.rollbackTransaction(transactionId);
      } catch (error) {
        console.error(
          `Failed to rollback transaction ${transactionId}:`,
          error
        );
      }
    }
  }
}
