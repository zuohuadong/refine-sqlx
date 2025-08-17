/**
 * Performance optimization utilities for RefineORM
 */

import type { CrudFilters, CrudSorting } from '@refinedev/core';

/**
 * Generic query cache for database operations
 */
class QueryCache {
  private cache = new Map<
    string,
    { result: any; timestamp: number; ttl: number }
  >();
  private hits = 0;
  private misses = 0;
  private maxSize = 1000;
  private defaultTTL = 5 * 60 * 1000; // 5 minutes

  constructor(maxSize = 1000, defaultTTL = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  /**
   * Generate cache key from query parameters
   */
  private generateKey(resource: string, params: any): string {
    return `${resource}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached result if available and not expired
   */
  get(resource: string, params: any): any | null {
    const key = this.generateKey(resource, params);
    const cached = this.cache.get(key);

    if (!cached) {
      this.misses++;
      return null;
    }

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    this.hits++;
    return cached.result;
  }

  /**
   * Set cache entry
   */
  set(resource: string, params: any, result: any, ttl = this.defaultTTL): void {
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (LRU-like behavior)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const key = this.generateKey(resource, params);
    this.cache.set(key, { result, timestamp: Date.now(), ttl });
  }

  /**
   * Clear cache for specific resource or all
   */
  clear(resource?: string): void {
    if (resource) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${resource}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
      this.hits = 0;
      this.misses = 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

/**
 * Connection pool optimizer with database-specific optimizations
 */
export class ConnectionPoolOptimizer {
  private totalQueries = 0;
  private queryTimes: number[] = [];
  private slowQueries: Array<{
    query: string;
    time: number;
    timestamp: number;
  }> = [];
  private maxQueryTimes = 1000;
  private slowQueryThreshold = 100; // 100ms
  private databaseType: 'postgresql' | 'mysql' | 'sqlite' | 'unknown' =
    'unknown';
  private connectionMetrics = {
    activeConnections: 0,
    totalConnections: 0,
    connectionErrors: 0,
    connectionTimeouts: 0,
    lastConnectionTime: 0,
  };

  constructor(databaseType?: 'postgresql' | 'mysql' | 'sqlite') {
    this.databaseType = databaseType || 'unknown';
  }

  /**
   * Track connection metrics for pool optimization
   */
  trackConnection(
    event: 'created' | 'acquired' | 'released' | 'error' | 'timeout',
    duration?: number
  ): void {
    const now = Date.now();

    switch (event) {
      case 'created':
        this.connectionMetrics.totalConnections++;
        this.connectionMetrics.activeConnections++;
        this.connectionMetrics.lastConnectionTime = duration || 0;
        break;
      case 'acquired':
        // Connection acquired from pool
        break;
      case 'released':
        // Connection returned to pool
        break;
      case 'error':
        this.connectionMetrics.connectionErrors++;
        break;
      case 'timeout':
        this.connectionMetrics.connectionTimeouts++;
        break;
    }
  }

  /**
   * Track query execution with optional query text for analysis
   */
  trackQuery(executionTime: number, queryText?: string): void {
    this.totalQueries++;
    this.queryTimes.push(executionTime);

    if (this.queryTimes.length > this.maxQueryTimes) {
      this.queryTimes.shift();
    }

    // Track slow queries for analysis
    if (executionTime > this.slowQueryThreshold && queryText) {
      this.slowQueries.push({
        query: queryText,
        time: executionTime,
        timestamp: Date.now(),
      });

      // Keep only recent slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries.shift();
      }
    }
  }

  /**
   * Get optimal pool size based on database type and query patterns
   */
  getOptimalPoolSize(): {
    min: number;
    max: number;
    recommended: {
      min: number;
      max: number;
      acquireTimeout: number;
      idleTimeout: number;
    };
  } {
    const avgQueryTime = this.getAverageQueryTime();
    const queryRate = this.getQueryRate();
    const errorRate =
      this.connectionMetrics.connectionErrors /
      Math.max(1, this.connectionMetrics.totalConnections);

    // Database-specific optimizations
    let baseMultiplier = 1;
    let maxConnections = 20;
    let acquireTimeout = 30000; // 30 seconds
    let idleTimeout = 600000; // 10 minutes

    switch (this.databaseType) {
      case 'postgresql':
        baseMultiplier = 1.5; // PostgreSQL handles more connections well
        maxConnections = 50;
        acquireTimeout = 60000; // 1 minute for PostgreSQL
        idleTimeout = 300000; // 5 minutes
        break;
      case 'mysql':
        baseMultiplier = 1.2;
        maxConnections = 30;
        acquireTimeout = 45000; // 45 seconds
        idleTimeout = 600000; // 10 minutes
        break;
      case 'sqlite':
        // SQLite is single-writer, so fewer connections needed
        return {
          min: 1,
          max: 3,
          recommended: {
            min: 1,
            max: 2,
            acquireTimeout: 10000, // 10 seconds
            idleTimeout: 300000, // 5 minutes
          },
        };
      default:
        baseMultiplier = 1;
        maxConnections = 20;
    }

    const baseSize = Math.ceil(
      queryRate * (avgQueryTime / 1000) * baseMultiplier
    );

    // Adjust based on error rate
    if (errorRate > 0.1) {
      // More than 10% error rate
      baseMultiplier *= 1.3; // Increase pool size to handle errors
      acquireTimeout *= 1.5; // Increase timeout
    }

    // Adjust based on connection timeouts
    if (this.connectionMetrics.connectionTimeouts > 5) {
      maxConnections = Math.min(maxConnections * 1.2, 100); // Increase max but cap at 100
    }

    const min = Math.max(2, Math.ceil(baseSize * 0.3));
    const max = Math.max(5, Math.min(maxConnections, baseSize * 2));

    return {
      min,
      max,
      recommended: {
        min: Math.max(min, 2),
        max: Math.min(max, maxConnections),
        acquireTimeout,
        idleTimeout,
      },
    };
  }

  /**
   * Get database-specific optimization recommendations
   */
  getOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];
    const avgTime = this.getAverageQueryTime();
    const slowQueryCount = this.slowQueries.length;

    // General recommendations
    if (avgTime > 200) {
      recommendations.push(
        'Average query time is high - consider adding indexes'
      );
    }

    if (slowQueryCount > 10) {
      recommendations.push(
        `${slowQueryCount} slow queries detected - review query patterns`
      );
    }

    // Database-specific recommendations
    switch (this.databaseType) {
      case 'postgresql':
        if (avgTime > 100) {
          recommendations.push(
            'Consider using EXPLAIN ANALYZE for slow queries'
          );
          recommendations.push(
            'Check if pg_stat_statements extension is enabled'
          );
        }
        break;
      case 'mysql':
        if (avgTime > 100) {
          recommendations.push('Enable slow query log for analysis');
          recommendations.push('Consider using MySQL Performance Schema');
        }
        break;
      case 'sqlite':
        if (avgTime > 50) {
          recommendations.push(
            'Consider enabling WAL mode for better concurrency'
          );
          recommendations.push(
            'Increase cache_size pragma for better performance'
          );
        }
        break;
    }

    return recommendations;
  }

  /**
   * Get average query execution time
   */
  private getAverageQueryTime(): number {
    if (this.queryTimes.length === 0) return 100;
    return (
      this.queryTimes.reduce((sum, time) => sum + time, 0) /
      this.queryTimes.length
    );
  }

  /**
   * Get query rate (queries per second)
   */
  private getQueryRate(): number {
    const recentQueries = this.queryTimes.slice(-100);
    if (recentQueries.length < 2) return 1;

    // Estimate based on recent activity
    const timeSpan = Math.max(10, recentQueries.length / 10);
    return recentQueries.length / timeSpan;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): {
    totalQueries: number;
    averageQueryTime: number;
    queryRate: number;
    slowQueries: number;
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
  } {
    return {
      totalQueries: this.totalQueries,
      averageQueryTime: this.getAverageQueryTime(),
      queryRate: this.getQueryRate(),
      slowQueries: this.slowQueries.length,
      optimalPoolSize: this.getOptimalPoolSize(),
      recommendations: this.getOptimizationRecommendations(),
    };
  }

  /**
   * Get slow queries for analysis
   */
  getSlowQueries(): Array<{ query: string; time: number; timestamp: number }> {
    return [...this.slowQueries];
  }
}

/**
 * Batch operation optimizer with adapter integration and performance enhancements
 */
export class BatchOptimizer {
  private pendingOperations: Array<{
    type: 'create' | 'update' | 'delete';
    resource: string;
    data: any;
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timestamp: number;
    priority: number;
  }> = [];

  private batchTimeout: NodeJS.Timeout | null = null;
  private batchSize = 100;
  private batchDelay = 50; // 50ms
  private executor?: BatchExecutor;
  private metrics = {
    totalBatches: 0,
    totalOperations: 0,
    averageBatchSize: 0,
    averageExecutionTime: 0,
    failedBatches: 0,
    lastBatchTime: 0,
  };
  private adaptiveBatching = true;
  private maxBatchSize = 1000;
  private minBatchSize = 10;

  constructor(
    options: {
      batchSize?: number;
      batchDelay?: number;
      executor?: BatchExecutor;
      adaptiveBatching?: boolean;
      maxBatchSize?: number;
      minBatchSize?: number;
    } = {}
  ) {
    this.batchSize = options.batchSize || 100;
    this.batchDelay = options.batchDelay || 50;
    this.executor = options.executor;
    this.adaptiveBatching = options.adaptiveBatching ?? true;
    this.maxBatchSize = options.maxBatchSize || 1000;
    this.minBatchSize = options.minBatchSize || 10;
  }

  /**
   * Dynamically adjust batch size based on performance metrics
   */
  private adjustBatchSize(): void {
    if (!this.adaptiveBatching || this.metrics.totalBatches < 5) {
      return; // Need some history to make adjustments
    }

    const avgExecutionTime = this.metrics.averageExecutionTime;
    const avgBatchSize = this.metrics.averageBatchSize;
    const failureRate = this.metrics.failedBatches / this.metrics.totalBatches;

    // If execution time is too high, reduce batch size
    if (avgExecutionTime > 5000 && avgBatchSize > this.minBatchSize) {
      // 5 seconds
      this.batchSize = Math.max(
        this.minBatchSize,
        Math.floor(this.batchSize * 0.8)
      );
    }
    // If execution time is low and failure rate is low, increase batch size
    else if (
      avgExecutionTime < 1000 &&
      failureRate < 0.05 &&
      avgBatchSize < this.maxBatchSize
    ) {
      // 1 second, 5% failure
      this.batchSize = Math.min(
        this.maxBatchSize,
        Math.floor(this.batchSize * 1.2)
      );
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(
    batchSize: number,
    executionTime: number,
    failed: boolean
  ): void {
    this.metrics.totalBatches++;
    this.metrics.totalOperations += batchSize;

    // Update running averages
    const totalBatches = this.metrics.totalBatches;
    this.metrics.averageBatchSize =
      (this.metrics.averageBatchSize * (totalBatches - 1) + batchSize) /
      totalBatches;
    this.metrics.averageExecutionTime =
      (this.metrics.averageExecutionTime * (totalBatches - 1) + executionTime) /
      totalBatches;

    if (failed) {
      this.metrics.failedBatches++;
    }

    this.metrics.lastBatchTime = Date.now();

    // Adjust batch size based on performance
    this.adjustBatchSize();
  }

  /**
   * Set batch executor for actual database operations
   */
  setExecutor(executor: BatchExecutor): void {
    this.executor = executor;
  }

  /**
   * Add operation to batch with priority support
   */
  addOperation(
    type: 'create' | 'update' | 'delete',
    resource: string,
    data: any,
    priority: number = 0
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const operation = {
        type,
        resource,
        data,
        resolve,
        reject,
        timestamp: Date.now(),
        priority,
      };

      // Insert operation based on priority (higher priority first)
      const insertIndex = this.pendingOperations.findIndex(
        op => op.priority < priority
      );
      if (insertIndex === -1) {
        this.pendingOperations.push(operation);
      } else {
        this.pendingOperations.splice(insertIndex, 0, operation);
      }

      if (this.pendingOperations.length >= this.batchSize) {
        this.executeBatch();
      } else if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.executeBatch();
        }, this.batchDelay);
      }
    });
  }

  /**
   * Force execute all pending operations immediately
   */
  async flush(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    await this.executeBatch();
  }

  /**
   * Execute pending batch operations with performance tracking
   */
  private async executeBatch(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }

    const operations = this.pendingOperations.splice(0);
    if (operations.length === 0) return;

    const startTime = Date.now();
    let batchFailed = false;

    try {
      // Group operations by type and resource for optimal batching
      const groups = new Map<string, typeof operations>();

      for (const op of operations) {
        const key = `${op.type}:${op.resource}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(op);
      }

      // Execute groups in parallel for better performance
      const groupPromises = Array.from(groups.entries()).map(
        async ([key, groupOps]) => {
          try {
            const [type, resource] = key.split(':');
            const results = await this.executeBatchGroup(
              type as any,
              resource,
              groupOps
            );

            groupOps.forEach((op, index) => {
              op.resolve(results[index] || op.data);
            });
          } catch (error) {
            batchFailed = true;
            groupOps.forEach(op => {
              op.reject(error);
            });
          }
        }
      );

      await Promise.all(groupPromises);
    } catch (error) {
      batchFailed = true;
      // Fallback: reject all operations
      operations.forEach(op => {
        op.reject(error);
      });
    } finally {
      const executionTime = Date.now() - startTime;
      this.updateMetrics(operations.length, executionTime, batchFailed);
    }
  }

  /**
   * Execute a group of similar operations using the configured executor
   */
  private async executeBatchGroup(
    type: 'create' | 'update' | 'delete',
    resource: string,
    operations: any[]
  ): Promise<any[]> {
    if (!this.executor) {
      // Fallback: execute operations individually
      return operations.map(op => op.data);
    }

    try {
      return await this.executor.executeBatch(
        type,
        resource,
        operations.map(op => op.data)
      );
    } catch (error) {
      // Fallback to individual execution if batch fails
      console.warn(
        `Batch execution failed for ${type} on ${resource}, falling back to individual operations`
      );
      return operations.map(op => op.data);
    }
  }

  /**
   * Get comprehensive batch statistics
   */
  getStats(): {
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
  } {
    const successRate =
      this.metrics.totalBatches > 0 ?
        (this.metrics.totalBatches - this.metrics.failedBatches) /
        this.metrics.totalBatches
      : 1;

    // Calculate recommended batch size based on performance
    let recommendedBatchSize = this.batchSize;
    if (this.metrics.averageExecutionTime > 3000) {
      // 3 seconds
      recommendedBatchSize = Math.max(
        this.minBatchSize,
        Math.floor(this.batchSize * 0.7)
      );
    } else if (this.metrics.averageExecutionTime < 500 && successRate > 0.95) {
      // 500ms, 95% success
      recommendedBatchSize = Math.min(
        this.maxBatchSize,
        Math.floor(this.batchSize * 1.3)
      );
    }

    return {
      pendingOperations: this.pendingOperations.length,
      batchSize: this.batchSize,
      batchDelay: this.batchDelay,
      metrics: { ...this.metrics, successRate },
      performance: {
        adaptiveBatching: this.adaptiveBatching,
        currentBatchSize: this.batchSize,
        maxBatchSize: this.maxBatchSize,
        minBatchSize: this.minBatchSize,
        recommendedBatchSize,
      },
    };
  }

  /**
   * Get performance recommendations for batch operations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const stats = this.getStats();

    if (stats.metrics.averageExecutionTime > 5000) {
      recommendations.push(
        'Batch execution time is high - consider reducing batch size'
      );
    }

    if (stats.metrics.successRate < 0.9) {
      recommendations.push(
        'High batch failure rate - consider smaller batch sizes or retry logic'
      );
    }

    if (stats.pendingOperations > stats.batchSize * 2) {
      recommendations.push(
        'High number of pending operations - consider increasing batch frequency'
      );
    }

    if (!stats.performance.adaptiveBatching) {
      recommendations.push(
        'Enable adaptive batching for automatic performance optimization'
      );
    }

    if (
      stats.metrics.totalBatches > 100 &&
      stats.performance.currentBatchSize ===
        stats.performance.recommendedBatchSize
    ) {
      recommendations.push(
        'Batch size is optimally tuned based on performance metrics'
      );
    }

    return recommendations;
  }
}

/**
 * Interface for batch execution implementation
 */
export interface BatchExecutor {
  executeBatch(
    type: 'create' | 'update' | 'delete',
    resource: string,
    data: any[]
  ): Promise<any[]>;
}

/**
 * Database-agnostic query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Optimize filters for better performance based on database type
   */
  static optimizeFilters(
    filters: CrudFilters,
    databaseType: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
  ): CrudFilters {
    if (!filters || filters.length === 0) return filters;

    const optimized = [...filters];

    // Database-specific optimizations
    switch (databaseType) {
      case 'postgresql':
        // PostgreSQL: Put equality filters first, then range filters
        optimized.sort((a, b) => {
          if ('operator' in a && 'operator' in b) {
            const aScore =
              a.operator === 'eq' ? 0
              : a.operator === 'in' ? 1
              : 2;
            const bScore =
              b.operator === 'eq' ? 0
              : b.operator === 'in' ? 1
              : 2;
            return aScore - bScore;
          }
          return 0;
        });
        break;

      case 'mysql':
        // MySQL: Similar to PostgreSQL but with different priorities
        optimized.sort((a, b) => {
          if ('operator' in a && 'operator' in b) {
            const aScore =
              a.operator === 'eq' ? 0
              : a.operator === 'in' ? 1
              : 2;
            const bScore =
              b.operator === 'eq' ? 0
              : b.operator === 'in' ? 1
              : 2;
            return aScore - bScore;
          }
          return 0;
        });
        break;

      case 'sqlite':
        // SQLite: Equality checks are fastest
        optimized.sort((a, b) => {
          if ('operator' in a && 'operator' in b) {
            const aScore = a.operator === 'eq' ? 0 : 1;
            const bScore = b.operator === 'eq' ? 0 : 1;
            return aScore - bScore;
          }
          return 0;
        });
        break;
    }

    return optimized;
  }

  /**
   * Optimize sorting for better performance
   */
  static optimizeSorting(sorting: CrudSorting): CrudSorting {
    if (!sorting || sorting.length === 0) return sorting;

    // Remove duplicate sort fields, keeping the last one
    const seen = new Set<string>();
    const optimized: CrudSorting = [];

    for (let i = sorting.length - 1; i >= 0; i--) {
      const sort = sorting[i];
      if (!seen.has(sort.field)) {
        seen.add(sort.field);
        optimized.unshift(sort);
      }
    }

    return optimized;
  }

  /**
   * Suggest indexes based on query patterns with database-specific syntax
   */
  static suggestIndexes(
    queryLog: Array<{
      filters: CrudFilters;
      sorting: CrudSorting;
      resource?: string;
    }>,
    databaseType: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
  ): Array<{ resource: string; suggestion: string; reason: string }> {
    const fieldFrequency = new Map<
      string,
      { count: number; resource: string }
    >();
    const suggestions: Array<{
      resource: string;
      suggestion: string;
      reason: string;
    }> = [];

    // Analyze filter and sort fields
    for (const query of queryLog) {
      const resource = query.resource || 'table_name';

      if (query.filters) {
        for (const filter of query.filters) {
          if ('field' in filter) {
            const key = `${resource}.${filter.field}`;
            const current = fieldFrequency.get(key) || { count: 0, resource };
            fieldFrequency.set(key, { count: current.count + 1, resource });
          }
        }
      }

      if (query.sorting) {
        for (const sort of query.sorting) {
          const key = `${resource}.${sort.field}`;
          const current = fieldFrequency.get(key) || { count: 0, resource };
          fieldFrequency.set(key, { count: current.count + 0.5, resource }); // Sort fields get half weight
        }
      }
    }

    // Generate database-specific index suggestions
    for (const [key, { count, resource }] of fieldFrequency) {
      if (count >= 5) {
        // Threshold for index suggestion
        const field = key.split('.')[1];
        let suggestion = '';
        let reason = '';

        switch (databaseType) {
          case 'postgresql':
            suggestion = `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_${resource}_${field} ON ${resource} (${field});`;
            reason = `Field '${field}' used in ${Math.round(count)} queries`;
            break;
          case 'mysql':
            suggestion = `CREATE INDEX idx_${resource}_${field} ON ${resource} (${field});`;
            reason = `Field '${field}' used in ${Math.round(count)} queries`;
            break;
          case 'sqlite':
            suggestion = `CREATE INDEX IF NOT EXISTS idx_${resource}_${field} ON ${resource} (${field});`;
            reason = `Field '${field}' used in ${Math.round(count)} queries`;
            break;
        }

        suggestions.push({ resource, suggestion, reason });
      }
    }

    return suggestions;
  }

  /**
   * Analyze query complexity and suggest optimizations
   */
  static analyzeQueryComplexity(
    filters: CrudFilters,
    sorting: CrudSorting
  ): { complexity: 'low' | 'medium' | 'high'; suggestions: string[] } {
    const suggestions: string[] = [];
    let complexityScore = 0;

    // Analyze filters
    if (filters) {
      complexityScore += filters.length;

      for (const filter of filters) {
        if ('operator' in filter) {
          switch (filter.operator) {
            case 'contains':
            case 'containss':
            case 'startswith':
            case 'endswith':
              complexityScore += 2; // Text searches are expensive
              suggestions.push(
                `Consider using full-text search for '${filter.field}' instead of ${filter.operator}`
              );
              break;
            case 'in':
            case 'nin':
              if (Array.isArray(filter.value) && filter.value.length > 100) {
                complexityScore += 3;
                suggestions.push(
                  `Large IN clause for '${filter.field}' (${filter.value.length} values) - consider alternative approaches`
                );
              }
              break;
          }
        }
      }
    }

    // Analyze sorting
    if (sorting && sorting.length > 3) {
      complexityScore += sorting.length;
      suggestions.push(
        'Multiple sort fields detected - consider composite indexes'
      );
    }

    let complexity: 'low' | 'medium' | 'high' = 'low';
    if (complexityScore > 10) {
      complexity = 'high';
    } else if (complexityScore > 5) {
      complexity = 'medium';
    }

    return { complexity, suggestions };
  }
}

// TypeScript 5.0 Decorators for performance monitoring
function Monitored(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    const start = performance.now();
    const result = originalMethod.apply(this, args);
    const end = performance.now();
    
    if (this.trackMethodPerformance) {
      this.trackMethodPerformance(propertyKey, end - start, args);
    }
    
    return result;
  };
  return descriptor;
}

function Cached(ttl: number = 300000) { // 5 minutes default
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { value: any; timestamp: number }>();
    
    descriptor.value = function (...args: any[]) {
      const key = JSON.stringify(args);
      const cached = cache.get(key);
      const now = Date.now();
      
      if (cached && (now - cached.timestamp) < ttl) {
        return cached.value;
      }
      
      const result = originalMethod.apply(this, args);
      cache.set(key, { value: result, timestamp: now });
      
      // Clean up expired entries
      for (const [k, v] of cache.entries()) {
        if ((now - v.timestamp) >= ttl) {
          cache.delete(k);
        }
      }
      
      return result;
    };
    return descriptor;
  };
}

function Debounced(delay: number = 100) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    let timeoutId: NodeJS.Timeout;
    
    descriptor.value = function (...args: any[]) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        originalMethod.apply(this, args);
      }, delay);
    };
    return descriptor;
  };
}

function Singleton(target: any) {
  let instance: any;
  return class extends target {
    constructor(...args: any[]) {
      if (instance) {
        return instance;
      }
      super(...args);
      instance = this;
    }
  };
}

/**
 * Comprehensive performance manager for RefineORM
 */
@Singleton
export class PerformanceManager {
  private cache: QueryCache;
  private poolOptimizer: ConnectionPoolOptimizer;
  private batchOptimizer: BatchOptimizer;
  private queryLog: Array<{
    filters: CrudFilters;
    sorting: CrudSorting;
    executionTime: number;
    resource?: string;
    queryText?: string;
  }> = [];
  private databaseType: 'postgresql' | 'mysql' | 'sqlite' | 'unknown';

  constructor(
    options: {
      cacheSize?: number;
      cacheTTL?: number;
      batchSize?: number;
      batchDelay?: number;
      databaseType?: 'postgresql' | 'mysql' | 'sqlite';
      batchExecutor?: BatchExecutor;
    } = {}
  ) {
    this.databaseType = options.databaseType || 'unknown';
    this.cache = new QueryCache(options.cacheSize, options.cacheTTL);
    this.poolOptimizer = new ConnectionPoolOptimizer(options.databaseType);
    this.batchOptimizer = new BatchOptimizer({
      batchSize: options.batchSize,
      batchDelay: options.batchDelay,
      executor: options.batchExecutor,
    });
  }

  /**
   * Track method performance for internal monitoring
   */
  private trackMethodPerformance(methodName: string, duration: number, args: any[]): void {
    if (duration > 100) { // Log slow operations
      console.warn(`[PerformanceManager] Slow operation detected: ${methodName} took ${duration.toFixed(2)}ms`);
    }
  }

  /**
   * Get query cache instance
   */
  @Cached(60000) // Cache for 1 minute
  getCache(): QueryCache {
    return this.cache;
  }

  /**
   * Get pool optimizer instance
   */
  @Cached(60000)
  getPoolOptimizer(): ConnectionPoolOptimizer {
    return this.poolOptimizer;
  }

  /**
   * Get batch optimizer instance
   */
  @Cached(60000)
  getBatchOptimizer(): BatchOptimizer {
    return this.batchOptimizer;
  }

  /**
   * Log query for comprehensive analysis
   */
  @Monitored
  @Debounced(50) // Debounce rapid logging
  logQuery(
    filters: CrudFilters,
    sorting: CrudSorting,
    executionTime: number,
    resource?: string,
    queryText?: string
  ): void {
    this.queryLog.push({
      filters,
      sorting,
      executionTime,
      resource,
      queryText,
    });

    this.poolOptimizer.trackQuery(executionTime, queryText);

    // Keep only recent queries (sliding window)
    if (this.queryLog.length > 10000) {
      this.queryLog.splice(0, 5000);
    }
  }

  /**
   * Get comprehensive performance recommendations
   */
  getRecommendations(): {
    indexSuggestions: Array<{
      resource: string;
      suggestion: string;
      reason: string;
    }>;
    poolOptimization: {
      min: number;
      max: number;
      recommended: {
        min: number;
        max: number;
        acquireTimeout: number;
        idleTimeout: number;
      };
    };
    cacheStats: { size: number; maxSize: number; hitRate: number };
    queryOptimizations: string[];
    batchStats: {
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
    const poolMetrics = this.poolOptimizer.getMetrics();
    const cacheStats = this.cache.getStats();
    const batchStats = this.batchOptimizer.getStats();

    // Determine overall health
    let overallHealth: 'excellent' | 'good' | 'needs-attention' | 'critical' =
      'excellent';

    if (poolMetrics.averageQueryTime > 500 || poolMetrics.slowQueries > 20) {
      overallHealth = 'critical';
    } else if (
      poolMetrics.averageQueryTime > 200 ||
      poolMetrics.slowQueries > 10
    ) {
      overallHealth = 'needs-attention';
    } else if (
      poolMetrics.averageQueryTime > 100 ||
      poolMetrics.slowQueries > 5
    ) {
      overallHealth = 'good';
    }

    return {
      indexSuggestions: QueryOptimizer.suggestIndexes(
        this.queryLog,
        this.databaseType === 'unknown' ? 'postgresql' : this.databaseType
      ),
      poolOptimization: poolMetrics.optimalPoolSize,
      cacheStats,
      queryOptimizations: poolMetrics.recommendations,
      batchStats: this.batchOptimizer.getStats(),
      overallHealth,
    };
  }

  /**
   * Get detailed performance report
   */
  getDetailedReport(): {
    summary: {
      totalQueries: number;
      averageQueryTime: number;
      cacheHitRate: number;
      slowQueries: number;
    };
    recommendations: ReturnType<PerformanceManager['getRecommendations']>;
    queryComplexityAnalysis: Array<{
      resource: string;
      complexity: 'low' | 'medium' | 'high';
      suggestions: string[];
    }>;
  } {
    const poolMetrics = this.poolOptimizer.getMetrics();
    const cacheStats = this.cache.getStats();
    const recommendations = this.getRecommendations();

    // Analyze query complexity by resource
    const resourceQueries = new Map<
      string,
      Array<{ filters: CrudFilters; sorting: CrudSorting }>
    >();

    for (const query of this.queryLog) {
      const resource = query.resource || 'unknown';
      if (!resourceQueries.has(resource)) {
        resourceQueries.set(resource, []);
      }
      resourceQueries
        .get(resource)!
        .push({ filters: query.filters, sorting: query.sorting });
    }

    const queryComplexityAnalysis = Array.from(resourceQueries.entries()).map(
      ([resource, queries]) => {
        // Analyze average complexity for this resource
        const complexities = queries.map(q =>
          QueryOptimizer.analyzeQueryComplexity(q.filters, q.sorting)
        );
        const avgComplexity =
          complexities.reduce((acc, c) => {
            const score =
              c.complexity === 'high' ? 3
              : c.complexity === 'medium' ? 2
              : 1;
            return acc + score;
          }, 0) / complexities.length;

        const overallComplexity: 'low' | 'medium' | 'high' =
          avgComplexity > 2.5 ? 'high'
          : avgComplexity > 1.5 ? 'medium'
          : 'low';

        const allSuggestions = complexities.flatMap(c => c.suggestions);
        const uniqueSuggestions = Array.from(new Set(allSuggestions));

        return {
          resource,
          complexity: overallComplexity,
          suggestions: uniqueSuggestions,
        };
      }
    );

    return {
      summary: {
        totalQueries: poolMetrics.totalQueries,
        averageQueryTime: poolMetrics.averageQueryTime,
        cacheHitRate: cacheStats.hitRate,
        slowQueries: poolMetrics.slowQueries,
      },
      recommendations,
      queryComplexityAnalysis,
    };
  }

  /**
   * Reset all performance data
   */
  reset(): void {
    this.cache.clear();
    this.queryLog = [];
    // Note: We don't reset pool optimizer as it needs historical data
  }
}

// Export singleton instance with default configuration
export const performanceManager = new PerformanceManager();

// Factory function for creating database-specific performance managers
export function createPerformanceManager(options: {
  databaseType: 'postgresql' | 'mysql' | 'sqlite';
  cacheSize?: number;
  cacheTTL?: number;
  batchSize?: number;
  batchDelay?: number;
  batchExecutor?: BatchExecutor;
}): PerformanceManager {
  return new PerformanceManager(options);
}

// Export individual classes for custom usage
export { QueryCache };
