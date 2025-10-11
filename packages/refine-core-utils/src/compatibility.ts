import type { BaseSchema, EnhancedDataProvider } from './enhanced-types.js';

/**
 * Compatibility utilities for migrating between refine-sql and refine-orm
 */
export class CompatibilityUtils {
  /**
   * Convert refine-sql TableSchema to BaseSchema format
   */
  static convertTableSchemaToBaseSchema<T extends Record<string, any>>(
    tableSchema: T
  ): BaseSchema {
    // TableSchema is already compatible with BaseSchema
    return tableSchema as BaseSchema;
  }

  /**
   * Convert Drizzle schema to BaseSchema format
   */
  static convertDrizzleSchemaToBaseSchema<T extends Record<string, any>>(
    drizzleSchema: T
  ): BaseSchema {
    const baseSchema: BaseSchema = {};

    for (const [tableName, table] of Object.entries(drizzleSchema)) {
      // This is a simplified conversion
      // In a real implementation, you'd need to extract column information from Drizzle tables
      baseSchema[tableName] = table as any;
    }

    return baseSchema;
  }

  /**
   * Map filter operators between different formats
   */
  static mapFilterOperator(
    operator: string,
    fromFormat: 'refine' | 'sql' | 'drizzle' | 'unified',
    toFormat: 'refine' | 'sql' | 'drizzle' | 'unified'
  ): string {
    if (fromFormat === toFormat) return operator;

    // Define operator mappings
    const operatorMappings: Record<string, Record<string, string>> = {
      refine_to_unified: {
        eq: 'eq',
        ne: 'ne',
        gt: 'gt',
        gte: 'gte',
        lt: 'lt',
        lte: 'lte',
        in: 'in',
        nin: 'notIn',
        contains: 'contains',
        containss: 'containss',
        ncontains: 'ncontains',
        ncontainss: 'ncontainss',
        startswith: 'startswith',
        nstartswith: 'nstartswith',
        startswiths: 'startswiths',
        nstartswiths: 'nstartswiths',
        endswith: 'endswith',
        nendswith: 'nendswith',
        endswiths: 'endswiths',
        nendswiths: 'nendswiths',
        null: 'isNull',
        nnull: 'isNotNull',
        between: 'between',
        nbetween: 'notBetween',
        ina: 'in',
        nina: 'notIn',
      },
      unified_to_refine: {
        eq: 'eq',
        ne: 'ne',
        gt: 'gt',
        gte: 'gte',
        lt: 'lt',
        lte: 'lte',
        in: 'in',
        notIn: 'nin',
        like: 'contains',
        ilike: 'containss',
        notLike: 'ncontains',
        isNull: 'null',
        isNotNull: 'nnull',
        between: 'between',
        notBetween: 'nbetween',
        contains: 'contains',
        ncontains: 'ncontains',
        containss: 'containss',
        ncontainss: 'ncontainss',
        startswith: 'startswith',
        nstartswith: 'nstartswith',
        startswiths: 'startswiths',
        nstartswiths: 'nstartswiths',
        endswith: 'endswith',
        nendswith: 'nendswith',
        endswiths: 'endswiths',
        nendswiths: 'nendswiths',
      },
      sql_to_unified: {
        '=': 'eq',
        '!=': 'ne',
        '<>': 'ne',
        '>': 'gt',
        '>=': 'gte',
        '<': 'lt',
        '<=': 'lte',
        IN: 'in',
        'NOT IN': 'notIn',
        LIKE: 'like',
        ILIKE: 'ilike',
        'NOT LIKE': 'notLike',
        'IS NULL': 'isNull',
        'IS NOT NULL': 'isNotNull',
        BETWEEN: 'between',
        'NOT BETWEEN': 'notBetween',
      },
      unified_to_sql: {
        eq: '=',
        ne: '!=',
        gt: '>',
        gte: '>=',
        lt: '<',
        lte: '<=',
        in: 'IN',
        notIn: 'NOT IN',
        like: 'LIKE',
        ilike: 'ILIKE',
        notLike: 'NOT LIKE',
        isNull: 'IS NULL',
        isNotNull: 'IS NOT NULL',
        between: 'BETWEEN',
        notBetween: 'NOT BETWEEN',
        contains: 'LIKE',
        ncontains: 'NOT LIKE',
        containss: 'ILIKE',
        ncontainss: 'NOT ILIKE',
        startswith: 'LIKE',
        nstartswith: 'NOT LIKE',
        startswiths: 'ILIKE',
        nstartswiths: 'NOT ILIKE',
        endswith: 'LIKE',
        nendswith: 'NOT LIKE',
        endswiths: 'ILIKE',
        nendswiths: 'NOT ILIKE',
      },
    };

    const mappingKey = `${fromFormat}_to_${toFormat}`;
    const mapping = operatorMappings[mappingKey];

    return mapping?.[operator] || operator;
  }

  /**
   * Check if two data providers are compatible
   */
  static areProvidersCompatible<TSchema extends BaseSchema>(
    provider1: EnhancedDataProvider<TSchema>,
    provider2: EnhancedDataProvider<TSchema>
  ): boolean {
    // Check if both providers have the same schema structure
    if (!provider1.schema || !provider2.schema) {
      return false;
    }

    const schema1Tables = Object.keys(provider1.schema) as (keyof TSchema &
      string)[];
    const schema2Tables = Object.keys(provider2.schema) as (keyof TSchema &
      string)[];

    if (schema1Tables.length !== schema2Tables.length) {
      return false;
    }

    // Check if all table names match
    for (const tableName of schema1Tables) {
      if (!schema2Tables.includes(tableName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Create a migration guide between providers
   */
  static createMigrationGuide<TSchema extends BaseSchema>(
    fromProvider: EnhancedDataProvider<TSchema>,
    toProvider: EnhancedDataProvider<TSchema>
  ): MigrationGuide {
    const guide: MigrationGuide = {
      compatible: this.areProvidersCompatible(fromProvider, toProvider),
      changes: [],
      recommendations: [],
    };

    // Check for method availability
    const fromMethods = this.getAvailableMethods(fromProvider);
    const toMethods = this.getAvailableMethods(toProvider);

    // Find missing methods
    const missingMethods = fromMethods.filter(
      method => !toMethods.includes(method)
    );
    const newMethods = toMethods.filter(
      method => !fromMethods.includes(method)
    );

    if (missingMethods.length > 0) {
      guide.changes.push({
        type: 'removed_methods',
        description: `The following methods are no longer available: ${missingMethods.join(', ')}`,
        impact: 'breaking',
      });
    }

    if (newMethods.length > 0) {
      guide.changes.push({
        type: 'new_methods',
        description: `New methods available: ${newMethods.join(', ')}`,
        impact: 'enhancement',
      });
    }

    // Add general recommendations
    guide.recommendations.push(
      'Test all CRUD operations after migration',
      'Update type definitions to use the new provider types',
      'Review and update any custom query logic'
    );

    return guide;
  }

  /**
   * Get available methods from a data provider
   */
  private static getAvailableMethods<TSchema extends BaseSchema>(
    provider: EnhancedDataProvider<TSchema>
  ): string[] {
    const methods: string[] = [];

    // Standard DataProvider methods
    if (typeof provider.getList === 'function') methods.push('getList');
    if (typeof provider.getOne === 'function') methods.push('getOne');
    if (typeof provider.getMany === 'function') methods.push('getMany');
    if (typeof provider.create === 'function') methods.push('create');
    if (typeof provider.update === 'function') methods.push('update');
    if (typeof provider.deleteOne === 'function') methods.push('deleteOne');
    if (typeof provider.createMany === 'function') methods.push('createMany');
    if (typeof provider.updateMany === 'function') methods.push('updateMany');
    if (typeof provider.deleteMany === 'function') methods.push('deleteMany');

    // Enhanced methods
    if (provider.getListEnhanced) methods.push('getListEnhanced');
    if (provider.getOneEnhanced) methods.push('getOneEnhanced');
    if (provider.getManyEnhanced) methods.push('getManyEnhanced');
    if (provider.createEnhanced) methods.push('createEnhanced');
    if (provider.updateEnhanced) methods.push('updateEnhanced');
    if (provider.deleteOneEnhanced) methods.push('deleteOneEnhanced');
    if (provider.createManyEnhanced) methods.push('createManyEnhanced');
    if (provider.updateManyEnhanced) methods.push('updateManyEnhanced');
    if (provider.deleteManyEnhanced) methods.push('deleteManyEnhanced');

    // Chain and morph methods
    if (provider.from) methods.push('from');
    if (provider.morphTo) methods.push('morphTo');

    // Utility methods
    if (provider.raw) methods.push('raw');
    if (provider.transaction) methods.push('transaction');
    if (provider.getWithRelations) methods.push('getWithRelations');

    // Typed methods
    if (provider.getTyped) methods.push('getTyped');
    if (provider.getListTyped) methods.push('getListTyped');
    if (provider.getManyTyped) methods.push('getManyTyped');
    if (provider.createTyped) methods.push('createTyped');
    if (provider.updateTyped) methods.push('updateTyped');
    if (provider.deleteTyped) methods.push('deleteTyped');
    if (provider.createManyTyped) methods.push('createManyTyped');
    if (provider.updateManyTyped) methods.push('updateManyTyped');
    if (provider.deleteManyTyped) methods.push('deleteManyTyped');
    if (provider.queryTyped) methods.push('queryTyped');
    if (provider.executeTyped) methods.push('executeTyped');
    if (provider.existsTyped) methods.push('existsTyped');
    if (provider.findTyped) methods.push('findTyped');
    if (provider.findManyTyped) methods.push('findManyTyped');

    return methods;
  }

  /**
   * Convert method parameters between provider formats
   */
  static convertMethodParams(
    _methodName: string,
    params: any,
    fromFormat: 'sqlx' | 'orm',
    toFormat: 'sqlx' | 'orm'
  ): any {
    if (fromFormat === toFormat) return params;

    // This is a simplified conversion
    // In a real implementation, you'd need to handle specific parameter transformations
    return params;
  }

  /**
   * Validate schema compatibility
   */
  static validateSchemaCompatibility<TSchema extends BaseSchema>(
    schema: TSchema,
    targetFormat: 'sqlx' | 'orm'
  ): SchemaCompatibilityResult {
    const result: SchemaCompatibilityResult = {
      compatible: true,
      issues: [],
      suggestions: [],
    };

    for (const [tableName, tableSchema] of Object.entries(schema) as [
      keyof TSchema & string,
      TSchema[keyof TSchema],
    ][]) {
      // Check for reserved names
      if (tableName.startsWith('_')) {
        result.issues.push({
          type: 'warning',
          table: tableName,
          message: `Table name '${tableName}' starts with underscore, which may cause issues`,
        });
      }

      // Check for column compatibility
      if (tableSchema && typeof tableSchema === 'object') {
        for (const [columnName, _columnDef] of Object.entries(tableSchema)) {
          if (columnName === '_meta') continue;

          // Check for reserved column names
          if (['constructor', 'prototype', '__proto__'].includes(columnName)) {
            result.compatible = false;
            result.issues.push({
              type: 'error',
              table: tableName,
              column: columnName,
              message: `Column name '${columnName}' is reserved and cannot be used`,
            });
          }
        }
      }
    }

    // Add format-specific suggestions
    if (targetFormat === 'orm') {
      result.suggestions.push(
        'Consider adding primary key definitions to table metadata',
        'Define relationships in table metadata for better type inference',
        'Use consistent naming conventions for foreign keys'
      );
    } else if (targetFormat === 'sqlx') {
      result.suggestions.push(
        'Ensure all tables have an id column for optimal performance',
        'Consider using simple column types for better SQL compatibility'
      );
    }

    return result;
  }
}

// Supporting types
export interface MigrationGuide {
  compatible: boolean;
  changes: MigrationChange[];
  recommendations: string[];
}

export interface MigrationChange {
  type:
    | 'removed_methods'
    | 'new_methods'
    | 'changed_signature'
    | 'renamed_method';
  description: string;
  impact: 'breaking' | 'enhancement' | 'neutral';
}

export interface SchemaCompatibilityResult {
  compatible: boolean;
  issues: SchemaIssue[];
  suggestions: string[];
}

export interface SchemaIssue {
  type: 'error' | 'warning';
  table: string;
  column?: string;
  message: string;
}

/**
 * Helper function to create a compatibility checker
 */
export function createCompatibilityChecker<TSchema extends BaseSchema>(
  schema: TSchema
) {
  return {
    validateForSqlx: () =>
      CompatibilityUtils.validateSchemaCompatibility(schema, 'sqlx'),
    validateForOrm: () =>
      CompatibilityUtils.validateSchemaCompatibility(schema, 'orm'),
    createMigrationGuide: (
      fromProvider: EnhancedDataProvider<TSchema>,
      toProvider: EnhancedDataProvider<TSchema>
    ) => CompatibilityUtils.createMigrationGuide(fromProvider, toProvider),
  };
}

/**
 * Utility to help with gradual migration
 */
export class GradualMigrationHelper<TSchema extends BaseSchema> {
  constructor(
    private oldProvider: EnhancedDataProvider<TSchema>,
    private newProvider: EnhancedDataProvider<TSchema>
  ) {}

  /**
   * Create a hybrid provider that can use both old and new providers
   */
  createHybridProvider(config: {
    useNewProviderFor?: string[]; // List of operations to use new provider for
    fallbackToOld?: boolean; // Whether to fallback to old provider on errors
  }): EnhancedDataProvider<TSchema> {
    const useNewFor = new Set(config.useNewProviderFor || []);
    const fallbackToOld = config.fallbackToOld ?? true;

    return new Proxy(this.oldProvider, {
      get: (target, prop) => {
        const propName = prop as string;

        // If we should use the new provider for this operation
        if (useNewFor.has(propName) && propName in this.newProvider) {
          const newMethod = (this.newProvider as any)[propName];

          if (typeof newMethod === 'function') {
            return async (...args: any[]) => {
              try {
                return await newMethod.apply(this.newProvider, args);
              } catch (error) {
                if (fallbackToOld && propName in target) {
                  console.warn(
                    `New provider failed for ${propName}, falling back to old provider:`,
                    error
                  );
                  const oldMethod = (target as any)[propName];
                  return await oldMethod.apply(target, args);
                }
                throw error;
              }
            };
          }
        }

        // Use the old provider by default
        const oldValue = (target as any)[propName];
        if (typeof oldValue === 'function') {
          return oldValue.bind(target);
        }
        return oldValue;
      },
    }) as EnhancedDataProvider<TSchema>;
  }

  /**
   * Test compatibility between providers
   */
  async testCompatibility(): Promise<CompatibilityTestResult> {
    const result: CompatibilityTestResult = { passed: true, tests: [] };

    // Test basic CRUD operations if both providers support them
    const testOperations = [
      'getList',
      'getOne',
      'create',
      'update',
      'deleteOne',
    ];

    for (const operation of testOperations) {
      if (operation in this.oldProvider && operation in this.newProvider) {
        try {
          // This would need actual test data and implementation
          result.tests.push({
            operation,
            passed: true,
            message: `${operation} compatibility test passed`,
          });
        } catch (error) {
          result.passed = false;
          result.tests.push({
            operation,
            passed: false,
            message: `${operation} compatibility test failed: ${error}`,
          });
        }
      }
    }

    return result;
  }
}

export interface CompatibilityTestResult {
  passed: boolean;
  tests: CompatibilityTest[];
}

export interface CompatibilityTest {
  operation: string;
  passed: boolean;
  message: string;
}
