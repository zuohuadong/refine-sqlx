import type { Table } from 'drizzle-orm';
import type { DrizzleClient } from '../types/client';
import type { DatabaseConfig, QueryContext } from '../types/config';
import { ConfigurationError } from '../types/errors';
import { performanceManager, QueryOptimizer } from '../utils/performance';
import type { CrudFilters, CrudSorting } from '@refinedev/core';

// TypeScript 5.0 Decorators for database adapters
export function ConnectionRequired<This, Args extends any[], Return>(
  originalMethod: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >
): (this: This, ...args: Args) => Return {
  return function (this: This, ...args: Args): Return {
    const self = this as any;
    if (!self.isConnected || !self.client) {
      throw new ConfigurationError(
        `Database connection required for ${String(context.name)}. Call connect() first.`
      );
    }
    return originalMethod.apply(this, args);
  };
}

export function LogDatabaseOperation<This, Args extends any[], Return>(
  originalMethod: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<
    This,
    (this: This, ...args: Args) => Return
  >
) {
  return async function (this: This, ...args: Args): Promise<Awaited<Return>> {
    const start = performance.now();
    try {
      const result = await originalMethod.apply(this, args);
      const end = performance.now();
      console.debug(
        `[DatabaseAdapter] ${String(context.name)} completed in ${(end - start).toFixed(2)}ms`
      );
      return result;
    } catch (error) {
      console.error(`[DatabaseAdapter] ${String(context.name)} failed:`, error);
      throw error;
    }
  };
}

export function RetryOnFailure(maxRetries: number = 3, delay: number = 1000) {
  return function <This, Args extends any[], Return>(
    originalMethod: (this: This, ...args: Args) => Return,
    context: ClassMethodDecoratorContext<
      This,
      (this: This, ...args: Args) => Return
    >
  ) {
    return async function (
      this: This,
      ...args: Args
    ): Promise<Awaited<Return>> {
      let lastError: Error;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          lastError = error as Error;

          if (attempt === maxRetries) {
            throw lastError;
          }

          console.warn(
            `[DatabaseAdapter] ${String(context.name)} attempt ${attempt} failed, retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      throw lastError!;
    };
  };
}

/**
 * Abstract base class for database adapters
 * Provides common functionality and interface for all database types
 */
export abstract class BaseDatabaseAdapter<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  protected client: DrizzleClient<TSchema> | null = null;
  protected isConnected = false;

  constructor(protected config: DatabaseConfig<TSchema>) {}

  /**
   * Establish database connection
   */
  abstract connect(): Promise<void>;

  /**
   * Close database connection
   */
  abstract disconnect(): Promise<void>;

  /**
   * Check if database connection is healthy
   */
  abstract healthCheck(): Promise<boolean>;

  /**
   * Execute raw SQL query
   */
  abstract raw<T = any>(sql: string, params?: any[]): Promise<T[]>;

  /**
   * Begin database transaction
   */
  abstract beginTransaction(): Promise<void>;

  /**
   * Commit database transaction
   */
  abstract commitTransaction(): Promise<void>;

  /**
   * Rollback database transaction
   */
  abstract rollbackTransaction(): Promise<void>;

  /**
   * Get the drizzle client instance
   */
  getClient(): DrizzleClient<TSchema> {
    if (!this.isConnected || !this.client) {
      throw new ConfigurationError(
        'Database connection required for getClient. Call connect() first.'
      );
    }
    if (!this.client) {
      throw new ConfigurationError(
        'Database client not initialized. Call connect() first.'
      );
    }
    return this.client;
  }

  /**
   * Check if adapter is connected
   */
  isConnectionActive(): boolean {
    return this.isConnected && this.client !== null;
  }

  /**
   * Get the database type
   */
  getDatabaseType(): string {
    return this.config.type;
  }

  /**
   * Execute a query with error handling, logging, and performance tracking
   */
  protected async executeWithLogging<T>(
    operation: () => Promise<T>,
    context: QueryContext
  ): Promise<T> {
    const startTime = Date.now();

    try {
      if (this.config.debug) {
        console.log(
          `[RefineORM] Executing ${context.operation} on ${context.resource}`
        );
      }

      const result = await operation();

      const executionTime = Date.now() - startTime;

      // Track performance metrics with enhanced logging
      performanceManager.logQuery(
        context.filters || [],
        context.sorters || [],
        executionTime,
        context.resource,
        context.sql // If available
      );

      if (this.config.logger) {
        if (typeof this.config.logger === 'function') {
          this.config.logger(`${context.operation} ${context.resource}`, [
            executionTime,
          ]);
        } else {
          console.log(
            `[RefineORM] ${context.operation} ${context.resource} (${executionTime}ms)`
          );
        }
      }

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(
        `[RefineORM] Error in ${context.operation} ${context.resource} (${executionTime}ms):`,
        error
      );
      throw error;
    }
  }

  /**
   * Optimize query parameters for better performance
   */
  protected optimizeQueryParams(
    filters?: CrudFilters,
    sorting?: CrudSorting
  ): { filters: CrudFilters; sorting: CrudSorting } {
    return {
      filters: QueryOptimizer.optimizeFilters(filters || []),
      sorting: QueryOptimizer.optimizeSorting(sorting || []),
    };
  }

  /**
   * Get performance recommendations for this adapter
   */
  getPerformanceRecommendations(): {
    indexSuggestions: Array<{
      resource: string;
      suggestion: string;
      reason: string;
    }>;
    poolOptimization: { min: number; max: number };
    cacheStats: { size: number; maxSize: number; hitRate: number };
    queryOptimizations: string[];
    batchStats: {
      pendingOperations: number;
      batchSize: number;
      batchDelay: number;
    };
    overallHealth: 'excellent' | 'good' | 'needs-attention' | 'critical';
  } {
    return performanceManager.getRecommendations();
  }

  /**
   * Clear performance cache for this adapter
   */
  clearPerformanceCache(resource?: string): void {
    performanceManager.getCache().clear(resource);
  }

  /**
   * Validate connection configuration
   */
  protected validateConfig(): void {
    if (!this.config.schema) {
      throw new ConfigurationError(
        'Schema is required in database configuration'
      );
    }

    if (!this.config.connection) {
      throw new ConfigurationError('Connection configuration is required');
    }
  }

  /**
   * Get connection string from config
   */
  protected getConnectionString(): string {
    if (typeof this.config.connection === 'string') {
      return this.config.connection;
    }

    throw new ConfigurationError(
      'Connection string format not supported by this adapter'
    );
  }

  /**
   * Get connection options from config
   */
  protected getConnectionOptions(): any {
    if (typeof this.config.connection === 'object') {
      return this.config.connection;
    }

    throw new ConfigurationError(
      'Connection options format not supported by this adapter'
    );
  }

  /**
   * Get adapter information (to be overridden by specific adapters)
   */
  getAdapterInfo(): {
    type: string;
    runtime: string;
    driver: string;
    supportsNativeDriver: boolean;
    isConnected: boolean;
    futureSupport: { bunSql: boolean };
  } {
    return {
      type: 'unknown',
      runtime: 'unknown',
      driver: 'unknown',
      supportsNativeDriver: false,
      isConnected: this.isConnected,
      futureSupport: { bunSql: false },
    };
  }
}
