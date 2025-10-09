/**
 * refine-orm compatibility factory functions
 * Provides the same API as refine-orm for seamless migration
 */

import type { BaseRecord } from '@refinedev/core';
import type { SqlClient } from './client';
import type { TableSchema } from './typed-methods';
import type { SQLiteOptions } from './types/config';
import type { D1Database } from '@cloudflare/workers-types';
import type { Database as BunDatabase } from 'bun:sqlite';
import type { DatabaseSync as NodeDatabase } from 'node:sqlite';
import type BetterSqlite3 from 'better-sqlite3';

import createDataProvider, { type EnhancedDataProvider } from './data-provider';
import {
  addCompatibilityLayer,
  CompatibleChainQuery,
} from './compatibility-layer';

/**
 * refine-orm compatible data provider interface
 */
export interface RefineOrmCompatibleProvider<
  TSchema extends TableSchema = TableSchema,
> extends Omit<EnhancedDataProvider<TSchema>, 'transaction'> {
  // Schema access (refine-orm style)
  schema: TSchema;

  // Chain query with refine-orm compatibility
  from<T extends BaseRecord = BaseRecord>(
    tableName: string
  ): CompatibleChainQuery<T>;

  // Advanced utilities (refine-orm style)
  upsert<TRecord = BaseRecord>(params: {
    resource: string;
    variables: Record<string, any>;
    conflictColumns?: string[];
  }): Promise<{ data: TRecord; created: boolean }>;

  firstOrCreate<TRecord = BaseRecord>(params: {
    resource: string;
    where: Record<string, any>;
    defaults?: Record<string, any>;
  }): Promise<{ data: TRecord; created: boolean }>;

  updateOrCreate<
    TRecord = BaseRecord,
    Variables = Record<string, unknown>,
  >(params: {
    resource: string;
    where: Record<string, any>;
    values: Variables;
  }): Promise<{ data: TRecord; created: boolean }>;

  // Raw SQL execution (refine-orm style)
  executeRaw<TRecord = any>(sql: string, params?: any[]): Promise<TRecord[]>;

  // Transaction support (refine-orm style)
  transaction<TResult>(
    callback: (tx: RefineOrmCompatibleProvider<TSchema>) => Promise<TResult>
  ): Promise<TResult>;

  // Performance monitoring (refine-orm style)
  enablePerformanceMonitoring(): void;
  getPerformanceMetrics(): {
    enabled: boolean;
    metrics: any[];
    summary: {
      totalQueries: number;
      averageDuration: number;
      successRate: number;
    };
  };
}

/**
 * Configuration for SQLite provider (refine-orm compatible)
 */
export interface SQLiteProviderConfig<
  TSchema extends TableSchema = TableSchema,
> {
  /** Database connection */
  connection:
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database;
  /** Table schema definition */
  schema: TSchema;
  /** Additional options */
  options?: SQLiteOptions & {
    /** Enable performance monitoring */
    enablePerformanceMonitoring?: boolean;
    /** Enable debug logging */
    debug?: boolean;
    /** Connection pool options */
    pool?: {
      min?: number;
      max?: number;
      acquireTimeoutMillis?: number;
      createTimeoutMillis?: number;
      destroyTimeoutMillis?: number;
      idleTimeoutMillis?: number;
      reapIntervalMillis?: number;
      createRetryIntervalMillis?: number;
    };
  };
}

/**
 * Create SQLite provider with refine-orm compatible API
 * This function provides the same interface as refine-orm's createSQLiteProvider
 *
 * @example
 * ```typescript
 * // File database
 * const provider = createSQLiteProvider({
 *   connection: './database.db',
 *   schema: { users, posts, comments }
 * });
 *
 * // Memory database
 * const provider = createSQLiteProvider({
 *   connection: ':memory:',
 *   schema: { users, posts }
 * });
 *
 * // Cloudflare D1
 * const provider = createSQLiteProvider({
 *   connection: env.DB, // D1 database
 *   schema: { users, posts }
 * });
 * ```
 */
export function createSQLiteProvider<TSchema extends TableSchema = TableSchema>(
  config: SQLiteProviderConfig<TSchema>
): RefineOrmCompatibleProvider<TSchema> {
  // Create base provider
  const baseProvider = createDataProvider(
    config.connection as any,
    config.options
  );

  // Add compatibility layer
  const compatibleProvider = addCompatibilityLayer(baseProvider);

  // Create enhanced provider with refine-orm style API
  const enhancedProvider: RefineOrmCompatibleProvider<TSchema> = {
    ...compatibleProvider,

    // Add schema property (refine-orm style)
    schema: config.schema,

    // Override from method to return CompatibleChainQuery
    from<T extends BaseRecord = BaseRecord>(
      tableName: string
    ): CompatibleChainQuery<T> {
      return new CompatibleChainQuery<T>(
        baseProvider.client as SqlClient,
        tableName
      );
    },

    // Override transaction method to match expected signature
    async transaction<TResult>(
      callback: (tx: RefineOrmCompatibleProvider<TSchema>) => Promise<TResult>
    ): Promise<TResult> {
      return compatibleProvider.transaction(async tx => {
        // Create a compatible transaction provider
        const txProvider: RefineOrmCompatibleProvider<TSchema> = {
          ...tx,
          schema: config.schema,
          from<T extends BaseRecord = BaseRecord>(
            tableName: string
          ): CompatibleChainQuery<T> {
            return new CompatibleChainQuery<T>(
              baseProvider.client as SqlClient,
              tableName
            );
          },
          async transaction<TResult>(
            nestedCallback: (
              nestedTx: RefineOrmCompatibleProvider<TSchema>
            ) => Promise<TResult>
          ): Promise<TResult> {
            return tx.transaction(async nestedTx => {
              const nestedTxProvider: RefineOrmCompatibleProvider<TSchema> = {
                ...nestedTx,
                schema: config.schema,
                from<T extends BaseRecord = BaseRecord>(
                  tableName: string
                ): CompatibleChainQuery<T> {
                  return new CompatibleChainQuery<T>(
                    baseProvider.client as SqlClient,
                    tableName
                  );
                },
                executeRaw:
                  (compatibleProvider as any).executeRaw?.bind(
                    compatibleProvider
                  ) || (async () => []),
                enablePerformanceMonitoring:
                  (compatibleProvider as any).enablePerformanceMonitoring?.bind(
                    compatibleProvider
                  ) || (() => {}),
                getPerformanceMetrics:
                  (compatibleProvider as any).getPerformanceMetrics?.bind(
                    compatibleProvider
                  ) ||
                  (() => ({
                    enabled: false,
                    metrics: [],
                    summary: {
                      totalQueries: 0,
                      averageDuration: 0,
                      successRate: 100,
                    },
                  })),
              } as RefineOrmCompatibleProvider<TSchema>;
              return nestedCallback(nestedTxProvider);
            });
          },
          executeRaw:
            (compatibleProvider as any).executeRaw?.bind(compatibleProvider) ||
            (async () => []),
          enablePerformanceMonitoring:
            (compatibleProvider as any).enablePerformanceMonitoring?.bind(
              compatibleProvider
            ) || (() => {}),
          getPerformanceMetrics:
            (compatibleProvider as any).getPerformanceMetrics?.bind(
              compatibleProvider
            ) ||
            (() => ({
              enabled: false,
              metrics: [],
              summary: {
                totalQueries: 0,
                averageDuration: 0,
                successRate: 100,
              },
            })),
        } as RefineOrmCompatibleProvider<TSchema>;

        return callback(txProvider);
      });
    },

    // Raw SQL execution
    executeRaw:
      (compatibleProvider as any).executeRaw?.bind(compatibleProvider) ||
      (async () => []),

    // Enable performance monitoring if requested
    ...(config.options?.enablePerformanceMonitoring && {
      enablePerformanceMonitoring:
        compatibleProvider.enablePerformanceMonitoring,
      getPerformanceMetrics: compatibleProvider.getPerformanceMetrics,
    }),
  };

  // Auto-enable performance monitoring if configured
  if (config.options?.enablePerformanceMonitoring) {
    enhancedProvider.enablePerformanceMonitoring();
  }

  // Enable debug logging if configured
  if (config.options?.debug && process.env.NODE_ENV === 'development') {
    console.log(
      '[refine-sql] SQLite provider created with refine-orm compatibility'
    );
    console.log('[refine-sql] Schema tables:', Object.keys(config.schema));
  }

  return enhancedProvider;
}

/**
 * Universal provider factory (refine-orm compatible)
 * Automatically detects database type and creates appropriate provider
 */
export interface UniversalProviderConfig<
  TSchema extends TableSchema = TableSchema,
> {
  /** Database type */
  database: 'sqlite';
  /** Connection configuration */
  connection:
    | string
    | ':memory:'
    | D1Database
    | BunDatabase
    | NodeDatabase
    | BetterSqlite3.Database;
  /** Table schema definition */
  schema: TSchema;
  /** Additional options */
  options?: SQLiteOptions & {
    enablePerformanceMonitoring?: boolean;
    debug?: boolean;
  };
}

/**
 * Create provider with automatic database type detection (refine-orm compatible)
 * Currently only supports SQLite, but maintains the same API as refine-orm
 *
 * @example
 * ```typescript
 * const provider = createProvider({
 *   database: 'sqlite',
 *   connection: './database.db',
 *   schema: { users, posts }
 * });
 * ```
 */
export function createProvider<TSchema extends TableSchema = TableSchema>(
  config: UniversalProviderConfig<TSchema>
): RefineOrmCompatibleProvider<TSchema> {
  if (config.database !== 'sqlite') {
    throw new Error(
      `Database type '${config.database}' is not supported. refine-sql only supports SQLite.`
    );
  }

  return createSQLiteProvider({
    connection: config.connection,
    schema: config.schema,
    options: config.options,
  });
}

/**
 * Migration helper functions
 */
export const MigrationHelpers = {
  /**
   * Check if current project is compatible with refine-sql
   */
  checkCompatibility(packageJson: any): {
    compatible: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for unsupported databases
    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    if (deps['pg'] || deps['postgres']) {
      issues.push('PostgreSQL is not supported in refine-sql');
      recommendations.push('Consider using refine-orm for PostgreSQL support');
    }
    if (deps['mysql2'] || deps['mysql']) {
      issues.push('MySQL is not supported in refine-sql');
      recommendations.push('Consider using refine-orm for MySQL support');
    }

    // Check for SQLite support
    if (
      deps['better-sqlite3'] ||
      deps['bun'] ||
      deps['@cloudflare/workers-types']
    ) {
      recommendations.push(
        'SQLite support detected - good for refine-sql migration'
      );
    }

    return { compatible: issues.length === 0, issues, recommendations };
  },

  /**
   * Generate migration checklist
   */
  generateChecklist(): string[] {
    return [
      '1. Update import statements from refine-orm to refine-sql',
      '2. Replace createSQLiteProvider with refine-sql version',
      '3. Update schema definitions (remove Drizzle dependency)',
      '4. Test chain query methods (most should work unchanged)',
      '5. Update relationship loading if using complex relationships',
      '6. Test batch operations and transactions',
      '7. Verify performance in your target environment',
      '8. Update deployment configuration for smaller bundle size',
    ];
  },

  /**
   * Get bundle size comparison
   */
  getBundleSizeComparison(): {
    refineOrm: string;
    refineSql: string;
    savings: string;
  } {
    return {
      refineOrm: '~150kB (with Drizzle)',
      refineSql: '~23kB (standalone)',
      savings: '~85% smaller',
    };
  },
};

/**
 * Code transformation utilities
 */
export const CodeTransformer = {
  /**
   * Transform refine-orm import statements to refine-sql
   */
  transformImports(code: string): string {
    return code
      .replace(/from ['"]refine-orm['"]/g, "from 'refine-sql'")
      .replace(
        /import.*from ['"]refine-orm['"]/g,
        "import { createSQLiteProvider } from 'refine-sql'"
      );
  },

  /**
   * Transform provider creation
   */
  transformProviderCreation(code: string): string {
    return code
      .replace(/createSQLiteProvider\(/g, 'createSQLiteProvider({')
      .replace(/,\s*schema\s*\)/g, ', schema })');
  },

  /**
   * Transform deprecated method calls
   */
  transformMethods(code: string): string {
    const methodTransforms = {
      '.whereEq(': '.where(',
      '.whereNe(': '.where(',
      '.whereGt(': '.where(',
      '.whereGte(': '.where(',
      '.whereLt(': '.where(',
      '.whereLte(': '.where(',
      '.orderByAsc(': '.orderBy(',
      '.orderByDesc(': '.orderBy(',
    };

    let transformedCode = code;
    Object.entries(methodTransforms).forEach(([oldMethod, newMethod]) => {
      transformedCode = transformedCode.replace(
        new RegExp(oldMethod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        newMethod
      );
    });

    return transformedCode;
  },

  /**
   * Full code transformation
   */
  transformCode(code: string): string {
    let transformed = code;
    transformed = this.transformImports(transformed);
    transformed = this.transformProviderCreation(transformed);
    transformed = this.transformMethods(transformed);
    return transformed;
  },
};

// Export compatibility types
export type { TableSchema, SQLiteOptions, EnhancedDataProvider };

// Re-export core functionality for convenience
export { CompatibleChainQuery, addCompatibilityLayer };
