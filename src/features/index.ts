/**
 * v0.5.0 - Feature Registry System
 *
 * Central registry and initialization for all features
 */

import type { ValidatedFeaturesConfig } from '../config';

/**
 * Base interface for all feature executors
 */
export interface FeatureExecutor {
  /**
   * Feature name for logging and debugging
   */
  readonly name: string;

  /**
   * Whether the feature is enabled
   */
  readonly enabled: boolean;

  /**
   * Initialize the feature
   * Called once during DataProvider creation
   */
  initialize(): Promise<void> | void;

  /**
   * Cleanup resources when the feature is disposed
   */
  dispose?(): Promise<void> | void;
}

/**
 * Feature registry that manages all feature executors
 */
export class FeatureRegistry {
  private features: Map<string, FeatureExecutor> = new Map();

  /**
   * Register a feature executor
   */
  register(feature: FeatureExecutor): void {
    if (this.features.has(feature.name)) {
      throw new Error(
        `[refine-sqlx] Feature '${feature.name}' is already registered`,
      );
    }

    this.features.set(feature.name, feature);
  }

  /**
   * Get a feature executor by name
   */
  get<T extends FeatureExecutor>(name: string): T | undefined {
    return this.features.get(name) as T | undefined;
  }

  /**
   * Check if a feature is registered and enabled
   */
  isEnabled(name: string): boolean {
    const feature = this.features.get(name);
    return feature?.enabled ?? false;
  }

  /**
   * Initialize all registered features
   */
  async initializeAll(): Promise<void> {
    const initPromises = Array.from(this.features.values())
      .filter((feature) => feature.enabled)
      .map((feature) => feature.initialize());

    await Promise.all(initPromises);
  }

  /**
   * Dispose all registered features
   */
  async disposeAll(): Promise<void> {
    const disposePromises = Array.from(this.features.values())
      .filter((feature) => feature.enabled && feature.dispose)
      .map((feature) => feature.dispose!());

    await Promise.all(disposePromises);
  }

  /**
   * Get all enabled features
   */
  getEnabledFeatures(): FeatureExecutor[] {
    return Array.from(this.features.values()).filter(
      (feature) => feature.enabled,
    );
  }

  /**
   * Clear all registered features
   */
  clear(): void {
    this.features.clear();
  }
}



/**
 * Shared context for all features
 */
export interface FeatureContext {
  /**
   * Database instance
   */
  db: any;

  /**
   * Schema definition
   */
  schema: Record<string, unknown>;

  /**
   * Configuration
   */
  config: ValidatedFeaturesConfig;

  /**
   * Logger function
   */
  log?: (message: string, ...args: any[]) => void;
}

// Export feature executors
export { RelationsExecutor } from './relations/executor';
export { AggregationsExecutor } from './aggregations/executor';
export { TransactionManager, TransactionContext } from './transactions/manager';
export { JSONParser } from './json/parser';
export { ViewDetector } from './views/detector';

// Export types
export type { RelationInclude } from './relations/executor';
export type {
  AggregateFunction,
  AggregateParams,
  AggregateResponse,
  HavingCondition,
  HavingLogical,
  HavingOperator,
} from './aggregations/executor';
