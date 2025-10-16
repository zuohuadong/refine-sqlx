/**
 * v0.5.0 - Unified Feature Configuration System
 *
 * This module provides the configuration interface for all integrated features
 * in refine-sqlx v0.5.0, following the architecture described in
 * INTEGRATION_DESIGN_v0.5.0_.md
 */

import type { RefineSQLConfig } from './types';

/**
 * Relations feature configuration
 */
export interface RelationsConfig {
  /**
   * Enable relation queries
   * @default false
   */
  enabled: boolean;

  /**
   * Maximum relation depth
   * @default 3
   */
  maxDepth?: number;

  /**
   * Default loading behavior
   * - 'lazy': Load relations only when requested
   * - 'eager': Always load configured relations
   * @default 'lazy'
   */
  defaultBehavior?: 'lazy' | 'eager';

  /**
   * Cache relation queries
   * @default false
   */
  cache?: boolean;
}

/**
 * Aggregations feature configuration
 */
export interface AggregationsConfig {
  /**
   * Enable aggregation functions
   * @default false
   */
  enabled: boolean;

  /**
   * Allowed aggregation functions
   * @default ['count', 'sum', 'avg', 'min', 'max', 'group']
   */
  functions?: Array<'count' | 'sum' | 'avg' | 'min' | 'max' | 'group'>;

  /**
   * Enable HAVING clause support
   * @default true
   */
  having?: boolean;
}

/**
 * Transactions feature configuration
 */
export interface TransactionsConfig {
  /**
   * Enable transaction support
   * @default false
   */
  enabled: boolean;

  /**
   * Default isolation level
   * @default 'read committed'
   */
  isolationLevel?:
    | 'read uncommitted'
    | 'read committed'
    | 'repeatable read'
    | 'serializable';

  /**
   * Transaction timeout in milliseconds
   * @default 5000
   */
  timeout?: number;

  /**
   * Auto-rollback on error
   * @default true
   */
  autoRollback?: boolean;
}

/**
 * JSON feature configuration
 */
export interface JSONConfig {
  /**
   * Enable JSON field handling
   * @default false
   */
  enabled: boolean;

  /**
   * Automatically detect JSON columns from schema
   * @default true
   */
  autoDetect?: boolean;

  /**
   * Maximum parsing depth
   * @default 10
   */
  parseDepth?: number;

  /**
   * Strict JSON parsing (throw on parse errors)
   * @default false
   */
  strict?: boolean;
}

/**
 * Views feature configuration
 */
export interface ViewsConfig {
  /**
   * Enable database view support
   * @default false
   */
  enabled: boolean;

  /**
   * Automatically detect views from database
   * @default true
   */
  autoDetect?: boolean;

  /**
   * Enforce read-only for views
   * @default true
   */
  readOnly?: boolean;

  /**
   * Writable views (exceptions to read-only rule)
   * @default []
   */
  writableViews?: string[];
}

/**
 * Unified feature configuration interface
 */
export interface FeaturesConfig {
  /**
   * Relation query support
   */
  relations?: RelationsConfig;

  /**
   * Aggregation functions
   */
  aggregations?: AggregationsConfig;

  /**
   * Transaction management
   */
  transactions?: TransactionsConfig;

  /**
   * JSON field handling
   */
  json?: JSONConfig;

  /**
   * Database view support
   */
  views?: ViewsConfig;
}

/**
 * Validated features configuration with defaults applied
 */
export interface ValidatedFeaturesConfig {
  relations: Required<RelationsConfig>;
  aggregations: Required<AggregationsConfig>;
  transactions: Required<TransactionsConfig>;
  json: Required<JSONConfig>;
  views: Required<ViewsConfig>;
}

/**
 * Validate and apply default values to feature configuration
 *
 * @param features - User-provided feature configuration
 * @returns Validated configuration with all defaults applied
 */
export function validateFeaturesConfig(
  features?: FeaturesConfig,
): ValidatedFeaturesConfig {
  return {
    relations: {
      enabled: features?.relations?.enabled ?? false,
      maxDepth: features?.relations?.maxDepth ?? 3,
      defaultBehavior: features?.relations?.defaultBehavior ?? 'lazy',
      cache: features?.relations?.cache ?? false,
    },
    aggregations: {
      enabled: features?.aggregations?.enabled ?? false,
      functions: features?.aggregations?.functions ?? [
        'count',
        'sum',
        'avg',
        'min',
        'max',
        'group',
      ],
      having: features?.aggregations?.having ?? true,
    },
    transactions: {
      enabled: features?.transactions?.enabled ?? false,
      isolationLevel: features?.transactions?.isolationLevel ?? 'read committed',
      timeout: features?.transactions?.timeout ?? 5000,
      autoRollback: features?.transactions?.autoRollback ?? true,
    },
    json: {
      enabled: features?.json?.enabled ?? false,
      autoDetect: features?.json?.autoDetect ?? true,
      parseDepth: features?.json?.parseDepth ?? 10,
      strict: features?.json?.strict ?? false,
    },
    views: {
      enabled: features?.views?.enabled ?? false,
      autoDetect: features?.views?.autoDetect ?? true,
      readOnly: features?.views?.readOnly ?? true,
      writableViews: features?.views?.writableViews ?? [],
    },
  };
}

/**
 * Validate complete configuration
 *
 * @param config - User-provided configuration
 * @throws Error if configuration is invalid
 */
export function validateConfig<TSchema extends Record<string, unknown>>(
  config: RefineSQLConfig<TSchema>,
): void {
  // Validate connection
  if (!config.connection) {
    throw new Error('[refine-sqlx] Database connection is required');
  }

  // Validate schema
  if (!config.schema || typeof config.schema !== 'object') {
    throw new Error('[refine-sqlx] Schema definition is required');
  }

  // Validate features if provided
  if (config.features) {
    // Validate relations config
    if (config.features.relations?.enabled) {
      const maxDepth = config.features.relations.maxDepth ?? 3;
      if (maxDepth < 1 || maxDepth > 10) {
        throw new Error(
          '[refine-sqlx] Relations maxDepth must be between 1 and 10',
        );
      }
    }

    // Validate aggregations config
    if (config.features.aggregations?.enabled) {
      const functions = config.features.aggregations.functions ?? [];
      const validFunctions = ['count', 'sum', 'avg', 'min', 'max', 'group'];

      for (const fn of functions) {
        if (!validFunctions.includes(fn)) {
          throw new Error(
            `[refine-sqlx] Invalid aggregation function: ${fn}. Must be one of: ${validFunctions.join(', ')}`,
          );
        }
      }
    }

    // Validate transactions config
    if (config.features.transactions?.enabled) {
      const timeout = config.features.transactions.timeout ?? 5000;
      if (timeout < 100 || timeout > 60000) {
        throw new Error(
          '[refine-sqlx] Transaction timeout must be between 100ms and 60000ms',
        );
      }
    }

    // Validate JSON config
    if (config.features.json?.enabled) {
      const parseDepth = config.features.json.parseDepth ?? 10;
      if (parseDepth < 1 || parseDepth > 100) {
        throw new Error(
          '[refine-sqlx] JSON parseDepth must be between 1 and 100',
        );
      }
    }
  }
}
