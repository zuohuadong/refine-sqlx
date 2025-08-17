/**
 * Migration utilities and helpers for smooth transition from refine-orm to refine-sql
 */

import type { BaseRecord } from '@refinedev/core';
import { addCompatibilityLayer } from './compatibility-layer';

// Define EnhancedDataProvider interface
export interface EnhancedDataProvider<TSchema extends Record<string, any> = Record<string, any>> {
  getList: (params: any) => Promise<any>;
  getOne: (params: any) => Promise<any>;
  create: (params: any) => Promise<any>;
  update: (params: any) => Promise<any>;
  deleteOne: (params: any) => Promise<any>;
  from: (table: string) => any;
}

/**
 * Migration configuration options
 */
export interface MigrationConfig {
  /** Enable compatibility mode for refine-orm APIs */
  enableCompatibilityMode?: boolean;
  /** Show deprecation warnings for old APIs */
  showDeprecationWarnings?: boolean;
  /** Automatically convert old method calls to new ones */
  autoConvert?: boolean;
  /** Log migration progress */
  logMigration?: boolean;
}

/**
 * Create a migration-friendly data provider
 * This wrapper provides both old and new APIs during the transition period
 */
export function createMigrationProvider<TSchema extends Record<string, any> = Record<string, any>>(
  dataProvider: any,
  config: MigrationConfig = {}
): MigrationCompatibleProvider<TSchema> {
  const {
    enableCompatibilityMode = true,
    showDeprecationWarnings = true,
    logMigration = false,
  } = config;

  if (logMigration) {
    console.log('[RefineSQL Migration] Creating migration-compatible provider');
  }

  // Add compatibility layer if enabled
  const compatibleProvider = enableCompatibilityMode
    ? addCompatibilityLayer(dataProvider)
    : dataProvider;

  // Wrap methods with deprecation warnings
  if (showDeprecationWarnings) {
    wrapWithDeprecationWarnings(compatibleProvider);
  }

  return compatibleProvider as unknown as MigrationCompatibleProvider<TSchema>;
}

/**
 * Wrap methods with deprecation warnings
 */
function wrapWithDeprecationWarnings(provider: any) {
  // Track which warnings have been shown to avoid spam
  const shownWarnings = new Set<string>();

  const warnOnce = (methodName: string, message: string) => {
    if (!shownWarnings.has(methodName)) {
      console.warn(`[RefineSQL Migration] ${message}`);
      shownWarnings.add(methodName);
    }
  };

  // Wrap the from method to return wrapped chain queries
  const originalFrom = provider.from;
  provider.from = function (tableName: string) {
    const chainQuery = originalFrom.call(this, tableName);
    return wrapChainQueryWithWarnings(chainQuery, warnOnce);
  };

  // Wrap getWithRelations if it exists
  if (provider.getWithRelations) {
    const originalGetWithRelations = provider.getWithRelations;
    provider.getWithRelations = function (...args: any[]) {
      warnOnce('getWithRelations',
        'getWithRelations is deprecated. Use chain queries with relationships instead.'
      );
      return originalGetWithRelations.apply(this, args);
    };
  }
}

/**
 * Wrap chain query methods with deprecation warnings
 */
function wrapChainQueryWithWarnings(chainQuery: any, warnOnce: (method: string, message: string) => void) {
  // Methods that should show deprecation warnings
  const deprecatedMethods = {
    whereEq: 'Use .where(field, "eq", value) instead of .whereEq(field, value)',
    whereNe: 'Use .where(field, "ne", value) instead of .whereNe(field, value)',
    whereGt: 'Use .where(field, "gt", value) instead of .whereGt(field, value)',
    whereGte: 'Use .where(field, "gte", value) instead of .whereGte(field, value)',
    whereLt: 'Use .where(field, "lt", value) instead of .whereLt(field, value)',
    whereLte: 'Use .where(field, "lte", value) instead of .whereLte(field, value)',
    orderByAsc: 'Use .orderBy(field, "asc") instead of .orderByAsc(field)',
    orderByDesc: 'Use .orderBy(field, "desc") instead of .orderByDesc(field)',
    getWithRelations: 'Relationships are now loaded automatically with .get() when configured',
  };

  // Wrap deprecated methods
  Object.entries(deprecatedMethods).forEach(([methodName, message]) => {
    if (chainQuery[methodName]) {
      const originalMethod = chainQuery[methodName];
      chainQuery[methodName] = function (...args: any[]) {
        warnOnce(methodName, message);
        return originalMethod.apply(this, args);
      };
    }
  });

  return chainQuery;
}

/**
 * Migration-compatible provider interface
 */
export interface MigrationCompatibleProvider<TSchema extends Record<string, any> = Record<string, any>> {
  // Standard refine methods
  getList: (params: any) => Promise<any>;
  getOne: (params: any) => Promise<any>;
  create: (params: any) => Promise<any>;
  update: (params: any) => Promise<any>;
  deleteOne: (params: any) => Promise<any>;

  // Chain query methods
  from: (table: string) => MigrationCompatibleChainQuery;

  // Compatibility methods
  getWithRelations?<TRecord = BaseRecord>(
    resource: string,
    id: any,
    relations?: string[]
  ): Promise<TRecord>;
}

/**
 * Migration-compatible chain query interface
 */
export interface MigrationCompatibleChainQuery<T extends BaseRecord = BaseRecord> {
  // New preferred methods
  where(field: string, operator: string, value: any): this;
  orderBy(field: string, direction?: 'asc' | 'desc'): this;

  // Legacy methods (with deprecation warnings)
  whereEq(field: string, value: any): this;
  whereNe(field: string, value: any): this;
  whereGt(field: string, value: any): this;
  whereGte(field: string, value: any): this;
  whereLt(field: string, value: any): this;
  whereLte(field: string, value: any): this;
  whereLike(field: string, value: any): this;
  whereIn(field: string, value: any[]): this;
  whereNotIn(field: string, value: any[]): this;
  whereNull(field: string): this;
  whereNotNull(field: string): this;
  orderByAsc(field: string): this;
  orderByDesc(field: string): this;

  // Relationship methods
  withHasOne(relationName: string, relatedTable: string, localKey?: string, relatedKey?: string): this;
  withHasMany(relationName: string, relatedTable: string, localKey?: string, relatedKey?: string): this;
  withBelongsTo(relationName: string, relatedTable: string, foreignKey?: string, relatedKey?: string): this;
  withBelongsToMany(
    relationName: string,
    relatedTable: string,
    pivotTable: string,
    localKey?: string,
    relatedKey?: string,
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this;

  // Execution methods
  get(): Promise<T[]>;
  first(): Promise<T | null>;
  count(): Promise<number>;
  getWithRelations(): Promise<T[]>; // Legacy method

  // Pagination and utilities
  limit(count: number): this;
  offset(count: number): this;
  paginate(page: number, pageSize?: number): this;
}

/**
 * Code transformation utilities for automated migration
 */
export class CodeTransformer {
  /**
   * Transform refine-orm code to refine-sql compatible code
   */
  static transformCode(code: string): string {
    let transformed = code;

    // Transform import statements
    transformed = transformed.replace(
      /import\s+{([^}]+)}\s+from\s+['"]refine-orm['"]/g,
      (_match, imports) => {
        const importList = imports.split(',').map((imp: string) => imp.trim());
        const transformedImports = importList.map((imp: string) => {
          switch (imp) {
            case 'createPostgreSQLProvider':
            case 'createMySQLProvider':
              return `// ${imp} - Not available in refine-sql (SQLite only)`;
            case 'createSQLiteProvider':
              return 'createProvider';
            default:
              return imp;
          }
        }).filter((imp: string) => !imp.startsWith('//')).join(', ');

        return `import { ${transformedImports} } from 'refine-sql';`;
      }
    );

    // Transform provider creation
    transformed = transformed.replace(
      /createSQLiteProvider\(/g,
      'createProvider('
    );

    // Transform chain query methods
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

    Object.entries(methodTransforms).forEach(([oldMethod, newMethod]) => {
      transformed = transformed.replace(new RegExp(oldMethod.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newMethod);
    });

    return transformed;
  }

  /**
   * Generate migration report
   */
  static generateMigrationReport(code: string): MigrationReport {
    const report: MigrationReport = {
      totalChanges: 0,
      changes: [],
      warnings: [],
      errors: [],
    };

    // Check for unsupported features
    if (code.includes('createPostgreSQLProvider') || code.includes('createMySQLProvider')) {
      report.errors.push({
        type: 'unsupported-database',
        message: 'PostgreSQL and MySQL are not supported in refine-sql. Only SQLite is supported.',
        line: 0,
      });
    }

    // Check for deprecated methods
    const deprecatedMethods = ['whereEq', 'whereNe', 'whereGt', 'whereGte', 'whereLt', 'whereLte', 'orderByAsc', 'orderByDesc'];
    deprecatedMethods.forEach(method => {
      const regex = new RegExp(`\\.${method}\\(`, 'g');
      const matches = code.match(regex);
      if (matches) {
        report.changes.push({
          type: 'method-rename',
          oldCode: `.${method}(`,
          newCode: method.startsWith('orderBy') ? '.orderBy(' : '.where(',
          count: matches.length,
        });
        report.totalChanges += matches.length;
      }
    });

    return report;
  }
}

/**
 * Migration report interface
 */
export interface MigrationReport {
  totalChanges: number;
  changes: Array<{
    type: string;
    oldCode: string;
    newCode: string;
    count: number;
  }>;
  warnings: Array<{
    type: string;
    message: string;
    line: number;
  }>;
  errors: Array<{
    type: string;
    message: string;
    line: number;
  }>;
}

/**
 * Migration helper functions
 */
export const MigrationHelpers = {
  /**
   * Check if current project is compatible with refine-sql
   */
  checkCompatibility(packageJson: any): CompatibilityCheck {
    const result: CompatibilityCheck = {
      compatible: true,
      issues: [],
      recommendations: [],
    };

    // Check dependencies
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    if (deps['drizzle-orm']) {
      result.issues.push({
        type: 'dependency',
        message: 'drizzle-orm dependency detected. refine-sql uses native SQL instead of Drizzle ORM.',
        severity: 'warning',
      });
    }

    if (deps['postgres'] || deps['mysql2']) {
      result.issues.push({
        type: 'database',
        message: 'PostgreSQL/MySQL dependencies detected. refine-sql only supports SQLite.',
        severity: 'error',
      });
      result.compatible = false;
    }

    if (deps['better-sqlite3']) {
      result.recommendations.push({
        type: 'optimization',
        message: 'better-sqlite3 is supported. Consider using Bun runtime for better performance.',
      });
    }

    return result;
  },

  /**
   * Generate migration checklist
   */
  generateChecklist(): MigrationChecklist {
    return {
      preRequisites: [
        'Ensure project only uses SQLite database',
        'Backup your current codebase',
        'Review current refine-orm usage patterns',
        'Check for custom Drizzle ORM queries',
      ],
      steps: [
        'Install refine-sql package',
        'Update import statements',
        'Replace provider creation calls',
        'Update chain query method calls',
        'Test relationship queries',
        'Update custom SQL queries if needed',
        'Run comprehensive tests',
      ],
      postMigration: [
        'Remove refine-orm dependency',
        'Remove drizzle-orm dependency (if not used elsewhere)',
        'Update documentation',
        'Monitor performance improvements',
      ],
    };
  },
};

/**
 * Compatibility check result
 */
export interface CompatibilityCheck {
  compatible: boolean;
  issues: Array<{
    type: string;
    message: string;
    severity: 'error' | 'warning' | 'info';
  }>;
  recommendations: Array<{
    type: string;
    message: string;
  }>;
}

/**
 * Migration checklist
 */
export interface MigrationChecklist {
  preRequisites: string[];
  steps: string[];
  postMigration: string[];
}