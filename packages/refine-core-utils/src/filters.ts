import type { CrudFilters } from '@refinedev/core';
import type {
  FilterTransformResult,
  TransformationContext,
  OperatorConfig,
  LogicalOperatorConfig,
  FilterOperator,
  LogicalOperator,
} from './types.js';
import {
  validateFilterValue,
  validateFieldName,
  isSupportedOperator,
  normalizeOperator,
  sanitizeStringValue,
} from './validation.js';

/**
 * SQL filter transformer with configurable operators
 */
export class SqlFilterTransformer {
  private operatorConfigs: Map<FilterOperator, OperatorConfig<string>>;
  private logicalConfigs: Map<LogicalOperator, LogicalOperatorConfig<string>>;

  constructor() {
    this.operatorConfigs = new Map();
    this.logicalConfigs = new Map();
    this.initializeDefaultOperators();
    this.initializeLogicalOperators();
  }

  private initializeDefaultOperators() {
    const configs: OperatorConfig<string>[] = [
      { operator: 'eq', transform: (field, _value) => `"${field}" = ?` },
      { operator: 'ne', transform: (field, _value) => `"${field}" != ?` },
      { operator: 'gt', transform: (field, _value) => `"${field}" > ?` },
      { operator: 'gte', transform: (field, _value) => `"${field}" >= ?` },
      { operator: 'lt', transform: (field, _value) => `"${field}" < ?` },
      { operator: 'lte', transform: (field, _value) => `"${field}" <= ?` },
      {
        operator: 'contains',
        transform: (field, _value) => `"${field}" LIKE ?`,
      },
      {
        operator: 'ncontains',
        transform: (field, _value) => `"${field}" NOT LIKE ?`,
      },
      {
        operator: 'containss',
        transform: (field, _value) => `"${field}" LIKE ? COLLATE BINARY`,
      },
      {
        operator: 'ncontainss',
        transform: (field, _value) => `"${field}" NOT LIKE ? COLLATE BINARY`,
      },
      {
        operator: 'startswith',
        transform: (field, _value) => `"${field}" LIKE ?`,
      },
      {
        operator: 'nstartswith',
        transform: (field, _value) => `"${field}" NOT LIKE ?`,
      },
      {
        operator: 'startswiths',
        transform: (field, _value) => `"${field}" LIKE ? COLLATE BINARY`,
      },
      {
        operator: 'nstartswiths',
        transform: (field, _value) => `"${field}" NOT LIKE ? COLLATE BINARY`,
      },
      {
        operator: 'endswith',
        transform: (field, _value) => `"${field}" LIKE ?`,
      },
      {
        operator: 'nendswith',
        transform: (field, _value) => `"${field}" NOT LIKE ?`,
      },
      {
        operator: 'endswiths',
        transform: (field, _value) => `"${field}" LIKE ? COLLATE BINARY`,
      },
      {
        operator: 'nendswiths',
        transform: (field, _value) => `"${field}" LIKE ? COLLATE BINARY`,
      },
      { operator: 'null', transform: field => `"${field}" IS NULL` },
      { operator: 'nnull', transform: field => `"${field}" IS NOT NULL` },
      {
        operator: 'in',
        transform: (field, value) => {
          const placeholders =
            Array.isArray(value) ? value.map(() => '?').join(', ') : '?';
          return `"${field}" IN (${placeholders})`;
        },
      },
      {
        operator: 'nin',
        transform: (field, value) => {
          const placeholders =
            Array.isArray(value) ? value.map(() => '?').join(', ') : '?';
          return `"${field}" NOT IN (${placeholders})`;
        },
      },
      {
        operator: 'between',
        transform: (field, _value) => `"${field}" BETWEEN ? AND ?`,
        validate: value => {
          if (!Array.isArray(value) || value.length !== 2) {
            return {
              message: 'Between operator requires array with exactly 2 values',
            };
          }
          return null;
        },
      },
      {
        operator: 'nbetween',
        transform: (field, _value) => `"${field}" NOT BETWEEN ? AND ?`,
        validate: value => {
          if (!Array.isArray(value) || value.length !== 2) {
            return {
              message:
                'Not between operator requires array with exactly 2 values',
            };
          }
          return null;
        },
      },
    ];

    configs.forEach(config => {
      this.operatorConfigs.set(config.operator, config);
    });
  }

  private initializeLogicalOperators() {
    this.logicalConfigs.set('and', {
      operator: 'and',
      combine: conditions =>
        conditions.length > 1 ?
          `(${conditions.join(' AND ')})`
        : conditions[0] || '',
    });

    this.logicalConfigs.set('or', {
      operator: 'or',
      combine: conditions =>
        conditions.length > 1 ?
          `(${conditions.join(' OR ')})`
        : conditions[0] || '',
    });
  }

  /**
   * Transform a single filter
   */
  transformFilter(
    filter: CrudFilters[0],
    context?: TransformationContext
  ): FilterTransformResult<string> {
    if ('field' in filter) {
      return this.transformSimpleFilter(filter, context);
    } else if ('operator' in filter) {
      return this.transformLogicalFilter(filter, context);
    }

    return { result: '', params: [], isEmpty: true };
  }

  /**
   * Transform multiple filters
   */
  transformFilters(
    filters: CrudFilters,
    context?: TransformationContext
  ): FilterTransformResult<string> {
    if (!filters || filters.length === 0) {
      return { result: '', params: [], isEmpty: true };
    }

    const conditions: string[] = [];
    const allParams: any[] = [];

    for (const filter of filters) {
      const transformed = this.transformFilter(filter, context);
      if (!transformed.isEmpty) {
        conditions.push(transformed.result);
        if (transformed.params) {
          allParams.push(...transformed.params);
        }
      }
    }

    if (conditions.length === 0) {
      return { result: '', params: [], isEmpty: true };
    }

    const result =
      conditions.length > 1 ? conditions.join(' AND ') : conditions[0];

    return { result, params: allParams, isEmpty: false };
  }

  private transformSimpleFilter(
    filter: Extract<CrudFilters[0], { field: string }>,
    context?: TransformationContext
  ): FilterTransformResult<string> {
    const { field, operator, value } = filter;

    // Validate field name
    const fieldError = validateFieldName(field);
    if (fieldError) {
      throw new Error(`Invalid filter field: ${fieldError.message}`);
    }

    // Normalize and validate operator
    if (!isSupportedOperator(operator)) {
      throw new Error(`Unsupported filter operator: ${operator}`);
    }

    const normalizedOperator = normalizeOperator(operator);
    const config = this.operatorConfigs.get(normalizedOperator);

    if (!config) {
      throw new Error(
        `No configuration found for operator: ${normalizedOperator}`
      );
    }

    // Validate value
    if (config.validate) {
      const valueError = config.validate(value);
      if (valueError) {
        throw new Error(`Invalid filter value: ${valueError.message}`);
      }
    }

    const valueError = validateFilterValue(normalizedOperator, value, field);
    if (valueError) {
      throw new Error(`Invalid filter value: ${valueError.message}`);
    }

    // Apply field mapping if provided
    const actualField = context?.fieldMapping?.[field] || field;

    // Transform the filter
    const sqlCondition = config.transform(actualField, value, context);
    const params = this.extractParams(normalizedOperator, value);

    return { result: sqlCondition, params, isEmpty: false };
  }

  private transformLogicalFilter(
    filter: Extract<CrudFilters[0], { operator: 'and' | 'or' }>,
    context?: TransformationContext
  ): FilterTransformResult<string> {
    const { operator, value } = filter;

    if (!Array.isArray(value) || value.length === 0) {
      return { result: '', params: [], isEmpty: true };
    }

    const config = this.logicalConfigs.get(operator);
    if (!config) {
      throw new Error(`Unsupported logical operator: ${operator}`);
    }

    const conditions: string[] = [];
    const allParams: any[] = [];

    for (const subFilter of value) {
      const transformed = this.transformFilter(subFilter, context);
      if (!transformed.isEmpty) {
        conditions.push(transformed.result);
        if (transformed.params) {
          allParams.push(...transformed.params);
        }
      }
    }

    if (conditions.length === 0) {
      return { result: '', params: [], isEmpty: true };
    }

    return {
      result: config.combine(conditions),
      params: allParams,
      isEmpty: false,
    };
  }

  private extractParams(operator: FilterOperator, value: any): any[] {
    switch (operator) {
      case 'null':
      case 'nnull':
        return [];

      case 'contains':
      case 'ncontains':
      case 'containss':
      case 'ncontainss':
        return [`%${sanitizeStringValue(value)}%`];

      case 'startswith':
      case 'nstartswith':
      case 'startswiths':
      case 'nstartswiths':
        return [`${sanitizeStringValue(value)}%`];

      case 'endswith':
      case 'nendswith':
      case 'endswiths':
      case 'nendswiths':
        return [`%${sanitizeStringValue(value)}`];

      case 'in':
      case 'nin':
        return Array.isArray(value) ? value : [value];

      case 'between':
      case 'nbetween':
        return Array.isArray(value) ? [value[0], value[1]] : [value];

      default:
        return [value];
    }
  }

  /**
   * Add custom operator configuration
   */
  addOperator(config: OperatorConfig<string>) {
    this.operatorConfigs.set(config.operator, config);
  }

  /**
   * Add custom logical operator configuration
   */
  addLogicalOperator(config: LogicalOperatorConfig<string>) {
    this.logicalConfigs.set(config.operator, config);
  }
}

/**
 * Generic filter transformer for other systems (like Drizzle ORM)
 */
export class GenericFilterTransformer<T> {
  private operatorConfigs: Map<FilterOperator, OperatorConfig<T>>;
  private logicalConfigs: Map<LogicalOperator, LogicalOperatorConfig<T>>;

  constructor(
    operatorConfigs: OperatorConfig<T>[],
    logicalConfigs: LogicalOperatorConfig<T>[]
  ) {
    this.operatorConfigs = new Map();
    this.logicalConfigs = new Map();

    operatorConfigs.forEach(config => {
      this.operatorConfigs.set(config.operator, config);
    });

    logicalConfigs.forEach(config => {
      this.logicalConfigs.set(config.operator, config);
    });
  }

  transformFilter(
    filter: CrudFilters[0],
    context?: TransformationContext
  ): FilterTransformResult<T> {
    if ('field' in filter) {
      return this.transformSimpleFilter(filter, context);
    } else if ('operator' in filter) {
      return this.transformLogicalFilter(filter, context);
    }

    throw new Error('Invalid filter structure');
  }

  transformFilters(
    filters: CrudFilters,
    context?: TransformationContext
  ): FilterTransformResult<T> {
    if (!filters || filters.length === 0) {
      throw new Error('No filters provided');
    }

    if (filters.length === 1) {
      const firstFilter = filters[0];
      if (firstFilter) {
        return this.transformFilter(firstFilter, context);
      }
    }

    // Multiple filters are combined with AND by default
    const andConfig = this.logicalConfigs.get('and');
    if (!andConfig) {
      throw new Error('AND logical operator not configured');
    }

    const conditions: T[] = [];

    for (const filter of filters) {
      const transformed = this.transformFilter(filter, context);
      if (!transformed.isEmpty) {
        conditions.push(transformed.result);
      }
    }

    if (conditions.length === 0) {
      throw new Error('No valid conditions found');
    }

    return { result: andConfig.combine(conditions), isEmpty: false };
  }

  private transformSimpleFilter(
    filter: Extract<CrudFilters[0], { field: string }>,
    context?: TransformationContext
  ): FilterTransformResult<T> {
    const { field, operator, value } = filter;

    // Validate field name
    const fieldError = validateFieldName(field);
    if (fieldError) {
      throw new Error(`Invalid filter field: ${fieldError.message}`);
    }

    // Normalize and validate operator
    if (!isSupportedOperator(operator)) {
      throw new Error(`Unsupported filter operator: ${operator}`);
    }

    const normalizedOperator = normalizeOperator(operator);
    const config = this.operatorConfigs.get(normalizedOperator);

    if (!config) {
      throw new Error(
        `No configuration found for operator: ${normalizedOperator}`
      );
    }

    // Validate value
    if (config.validate) {
      const valueError = config.validate(value);
      if (valueError) {
        throw new Error(`Invalid filter value: ${valueError.message}`);
      }
    }

    const valueError = validateFilterValue(normalizedOperator, value, field);
    if (valueError) {
      throw new Error(`Invalid filter value: ${valueError.message}`);
    }

    // Apply field mapping if provided
    const actualField = context?.fieldMapping?.[field] || field;

    // Transform the filter
    const result = config.transform(actualField, value, context);

    return { result, isEmpty: false };
  }

  private transformLogicalFilter(
    filter: Extract<CrudFilters[0], { operator: 'and' | 'or' }>,
    context?: TransformationContext
  ): FilterTransformResult<T> {
    const { operator, value } = filter;

    if (!Array.isArray(value) || value.length === 0) {
      throw new Error(
        `${operator} operator requires a non-empty array of filters`
      );
    }

    const config = this.logicalConfigs.get(operator);
    if (!config) {
      throw new Error(`Unsupported logical operator: ${operator}`);
    }

    const conditions: T[] = [];

    for (const subFilter of value) {
      const transformed = this.transformFilter(subFilter, context);
      if (!transformed.isEmpty) {
        conditions.push(transformed.result);
      }
    }

    if (conditions.length === 0) {
      throw new Error('No valid conditions found in logical filter');
    }

    return { result: config.combine(conditions), isEmpty: false };
  }
}
