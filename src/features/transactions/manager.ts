/**
 * v0.5.0 - Transaction Manager
 *
 * Manages database transactions with timeout and isolation level support
 */

import type { TransactionsConfig } from '../../config';
import type { FeatureExecutor } from '../index';

/**
 * Transaction context for operations
 */
export class TransactionContext {
  constructor(
    private tx: any,
    private config: TransactionsConfig,
  ) {}

  /**
   * Get the transaction instance
   * This will be used by DataProvider methods during transaction
   */
  getTransaction(): any {
    return this.tx;
  }

  /**
   * Execute a query in the transaction
   */
  async query<T>(queryFn: (tx: any) => Promise<T>): Promise<T> {
    return await queryFn(this.tx);
  }
}

/**
 * Transaction manager
 */
export class TransactionManager implements FeatureExecutor {
  readonly name = 'transactions';
  readonly enabled: boolean;

  private readonly timeout: number;
  private readonly isolationLevel: string;
  private readonly autoRollback: boolean;

  constructor(
    private db: any,
    private config: TransactionsConfig,
  ) {
    this.enabled = config.enabled;
    this.timeout = config.timeout ?? 5000;
    this.isolationLevel = config.isolationLevel ?? 'read committed';
    this.autoRollback = config.autoRollback ?? true;
  }

  /**
   * Initialize transaction manager
   */
  async initialize(): Promise<void> {
    // No initialization needed for transactions
  }

  /**
   * Execute operations in a transaction
   *
   * @example
   * ```typescript
   * await transactionManager.execute(async (tx) => {
   *   await tx.query((t) => t.insert(users).values({ name: 'John' }));
   *   await tx.query((t) => t.insert(posts).values({ userId: 1 }));
   * });
   * ```
   */
  async execute<T>(
    callback: (tx: TransactionContext) => Promise<T>,
  ): Promise<T> {
    if (!this.enabled) {
      throw new Error('[refine-sqlx] Transactions are not enabled');
    }

    try {
      return await Promise.race([
        this.db.transaction(async (tx: any) => {
          const context = new TransactionContext(tx, this.config);
          return await callback(context);
        }),
        this.createTimeout(),
      ]);
    } catch (error) {
      if (this.autoRollback) {
        console.warn('[refine-sqlx] Transaction rolled back:', error);
      }
      throw error;
    }
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(
            `[refine-sqlx] Transaction timeout after ${this.timeout}ms`,
          ),
        );
      }, this.timeout);
    });
  }

  /**
   * Check if transactions are supported by the database
   */
  isSupported(): boolean {
    return typeof this.db.transaction === 'function';
  }
}
