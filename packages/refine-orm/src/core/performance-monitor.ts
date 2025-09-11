/**
 * Performance monitoring and optimization for RefineORM
 * Provides real-time performance tracking and optimization recommendations
 */

import type { CrudFilters, CrudSorting } from '@refinedev/core';
import { PerformanceManager, type BatchExecutor } from '../utils/performance';

/**
 * Performance monitor for RefineORM operations
 * Tracks query performance, connection health, and batch operations
 */
export class RefineOrmPerformanceMonitor {
  private performanceManager: PerformanceManager;
  private databaseType: 'postgresql' | 'mysql' | 'sqlite';
  private isEnabled: boolean;

  constructor(options: {
    databaseType: 'postgresql' | 'mysql' | 'sqlite';
    enabled?: boolean;
    cacheSize?: number;
    cacheTTL?: number;
    batchSize?: number;
    batchDelay?: number;
    batchExecutor?: BatchExecutor;
  }) {
    this.databaseType = options.databaseType;
    this.isEnabled = options.enabled ?? true;

    this.performanceManager = new PerformanceManager({
      databaseType: options.databaseType,
      ...(options.cacheSize !== undefined && { cacheSize: options.cacheSize }),
      ...(options.cacheTTL !== undefined && { cacheTTL: options.cacheTTL }),
      ...(options.batchSize !== undefined && { batchSize: options.batchSize }),
      ...(options.batchDelay !== undefined && {
        batchDelay: options.batchDelay,
      }),
      ...(options.batchExecutor !== undefined && {
        batchExecutor: options.batchExecutor,
      }),
    });
  }

  /**
   * Track a query execution for performance analysis
   */
  trackQuery(
    resource: string,
    _operation: 'select' | 'insert' | 'update' | 'delete',
    filters: CrudFilters,
    sorting: CrudSorting,
    executionTime: number,
    queryText?: string
  ): void {
    if (!this.isEnabled) return;

    this.performanceManager.logQuery(
      filters,
      sorting,
      executionTime,
      resource,
      queryText
    );
  }

  /**
   * Track connection events for pool optimization
   */
  trackConnection(
    event: 'created' | 'acquired' | 'released' | 'error' | 'timeout',
    duration?: number
  ): void {
    if (!this.isEnabled) return;

    this.performanceManager.getPoolOptimizer().trackConnection(event, duration);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): {
    database: string;
    performance: {
      totalQueries: number;
      averageQueryTime: number;
      cacheHitRate: number;
      slowQueries: number;
    };
    connections: {
      optimalPoolSize: {
        min: number;
        max: number;
        recommended: {
          min: number;
          max: number;
          acquireTimeout: number;
          idleTimeout: number;
        };
      };
      recommendations: string[];
    };
    batching: {
      pendingOperations: number;
      batchSize: number;
      batchDelay: number;
      metrics: {
        totalBatches: number;
        totalOperations: number;
        averageBatchSize: number;
        averageExecutionTime: number;
        failedBatches: number;
        successRate: number;
        lastBatchTime: number;
      };
      performance: {
        adaptiveBatching: boolean;
        currentBatchSize: number;
        maxBatchSize: number;
        minBatchSize: number;
        recommendedBatchSize: number;
      };
    };
    overallHealth: 'excellent' | 'good' | 'needs-attention' | 'critical';
  } {
    const recommendations = this.performanceManager.getRecommendations();
    const detailedReport = this.performanceManager.getDetailedReport();

    return {
      database: this.databaseType,
      performance: detailedReport.summary,
      connections: {
        optimalPoolSize: recommendations.poolOptimization,
        recommendations: recommendations.queryOptimizations,
      },
      batching: recommendations.batchStats,
      overallHealth: recommendations.overallHealth,
    };
  }

  /**
   * Enable or disable performance monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Reset all performance data
   */
  reset(): void {
    this.performanceManager.reset();
  }

  /**
   * Get the underlying performance manager for advanced usage
   */
  getPerformanceManager(): PerformanceManager {
    return this.performanceManager;
  }
}

/**
 * Factory function to create performance monitor for specific database type
 */
export function createPerformanceMonitor(options: {
  databaseType: 'postgresql' | 'mysql' | 'sqlite';
  enabled?: boolean;
  cacheSize?: number;
  cacheTTL?: number;
  batchSize?: number;
  batchDelay?: number;
  batchExecutor?: BatchExecutor;
}): RefineOrmPerformanceMonitor {
  return new RefineOrmPerformanceMonitor(options);
}

/**
 * Global performance monitor instance (can be configured per application)
 */
let globalPerformanceMonitor: RefineOrmPerformanceMonitor | null = null;

/**
 * Set global performance monitor
 */
export function setGlobalPerformanceMonitor(
  monitor: RefineOrmPerformanceMonitor
): void {
  globalPerformanceMonitor = monitor;
}

/**
 * Get global performance monitor
 */
export function getGlobalPerformanceMonitor(): RefineOrmPerformanceMonitor | null {
  return globalPerformanceMonitor;
}
