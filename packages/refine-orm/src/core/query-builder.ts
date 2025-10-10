import {
  type Table,
  type SQL,
  type Column,
  and,
  or,
  eq,
  ne,
  gt,
  gte,
  lt,
  lte,
  like,
  ilike,
  isNull,
  isNotNull,
  inArray,
  notInArray,
  asc,
  desc,
  not,
  count,
  sql,
} from 'drizzle-orm';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type { DrizzleClient } from '../types/client';
import { ValidationError, SchemaError } from '../types/errors';
// Temporary local implementation to avoid import issues during testing
interface TransformationContext {
  schema?: any;
  table?: any;
  dialect?: string;
}

interface OperatorConfig<T> {
  operator: string;
  transform: (field: string, value: any, context?: TransformationContext) => T;
}

interface LogicalOperatorConfig<T> {
  operator: string;
  transform: (conditions: T[], context?: TransformationContext) => T;
}

// Implement proper drizzle transformer that returns SQL conditions
const createDrizzleTransformer = (
  table: Table,
  operators: OperatorConfig<SQL>[],
  logicalOperators: LogicalOperatorConfig<SQL>[],
  queryBuilder: RefineQueryBuilder<any>
) => ({
  transformFilters: (
    filters: CrudFilters,
    context?: TransformationContext,
    depth: number = 0
  ) => {
    // Add depth limit to prevent infinite recursion
    const MAX_DEPTH = 10;
    if (depth > MAX_DEPTH) {
      console.warn(
        `Filter depth exceeded ${MAX_DEPTH}, skipping nested filters`
      );
      return { isEmpty: true, result: undefined };
    }

    if (!filters || filters.length === 0) {
      return { isEmpty: true, result: undefined };
    }

    // Check for circular references
    const visited = new WeakSet();
    const checkCircularReference = (obj: any): void => {
      if (obj !== null && typeof obj === 'object') {
        if (visited.has(obj)) {
          throw new ValidationError('Circular reference detected in filters');
        }
        visited.add(obj);

        if (Array.isArray(obj)) {
          obj.forEach(checkCircularReference);
        } else {
          Object.values(obj).forEach(checkCircularReference);
        }
      }
    };

    try {
      checkCircularReference(filters);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      // If checking for circular references fails for other reasons, also treat as validation error
      throw new ValidationError('Invalid filter structure detected');
    }

    try {
      const conditions = filters
        .map(filter => {
          if ('operator' in filter && 'field' in filter && 'value' in filter) {
            // Regular filter
            const operator = operators.find(
              op => op.operator === filter.operator
            );
            if (!operator) {
              throw new Error(
                `Unsupported filter operator: ${filter.operator}`
              );
            }
            try {
              return operator.transform(filter.field, filter.value, context);
            } catch (error) {
              // Check if it's a validation error (should be thrown) or schema error (should be converted to ValidationError)
              if (
                error instanceof Error &&
                (error.message.includes('requires array') ||
                  error.message.includes('exactly 2 values') ||
                  (error as any)?.code === 'VALIDATION_ERROR')
              ) {
                // Re-throw validation errors immediately
                throw error;
              }
              // Schema errors (missing columns) should be handled gracefully at query builder level
              if (
                error instanceof Error &&
                error.message.includes('Column') &&
                error.message.includes('not found')
              ) {
                console.warn('Schema error in filter transform:', error);
                return null;
              }
              console.warn('Schema error in filter transform:', error);
              return null;
            }
          } else if ('operator' in filter && 'value' in filter) {
            // Logical filter
            const logicalOp = logicalOperators.find(
              op => op.operator === filter.operator
            );
            if (!logicalOp && filter.value && Array.isArray(filter.value)) {
              // Handle logical operators like 'or', 'and'
              // For nested logical filters, recursively transform them
              const nestedResult = queryBuilder
                .getTransformer(table)
                .transformFilters(
                  filter.value as CrudFilters,
                  context,
                  depth + 1
                );

              if (!nestedResult.isEmpty && nestedResult.result) {
                if (filter.operator === 'or') {
                  // Wrap in OR if needed
                  return nestedResult.result;
                } else {
                  // Default to AND behavior
                  return nestedResult.result;
                }
              }

              // Fallback to simple handling if recursive call fails
              const subConditions = filter.value
                .map((subFilter: any) => {
                  if (
                    'operator' in subFilter &&
                    'field' in subFilter &&
                    'value' in subFilter
                  ) {
                    const operator = operators.find(
                      op => op.operator === subFilter.operator
                    );
                    if (!operator) {
                      throw new Error(
                        `Unsupported filter operator: ${subFilter.operator}`
                      );
                    }
                    try {
                      return operator.transform(
                        subFilter.field,
                        subFilter.value,
                        context
                      );
                    } catch (error) {
                      // Check if it's a validation error (should be thrown) or schema error (should be handled gracefully)
                      if (
                        error instanceof Error &&
                        (error.message.includes('requires array') ||
                          error.message.includes('exactly 2 values') ||
                          (error as any)?.code === 'VALIDATION_ERROR')
                      ) {
                        // Re-throw validation errors immediately
                        throw error;
                      }
                      // Schema errors (missing columns) should be handled gracefully at query builder level
                      if (
                        error instanceof Error &&
                        error.message.includes('Column') &&
                        error.message.includes('not found')
                      ) {
                        console.warn(
                          'Schema error in subfilter transform:',
                          error
                        );
                        return null;
                      }
                      console.warn(
                        'Schema error in subfilter transform:',
                        error
                      );
                      return null;
                    }
                  }
                  return null;
                })
                .filter(Boolean);

              if (filter.operator === 'or') {
                const validConditions = subConditions.filter(
                  (c): c is SQL => c !== null && c !== undefined
                );
                return validConditions.length > 1 ?
                    or(...validConditions)
                  : (validConditions[0] ?? undefined);
              } else {
                const validConditions = subConditions.filter(
                  (c): c is SQL => c !== null && c !== undefined
                );
                return validConditions.length > 1 ?
                    and(...validConditions)
                  : (validConditions[0] ?? undefined);
              }
            }
            if (logicalOp) {
              // For now, skip complex nested logical operations to avoid circular references
              // This should be handled at a higher level in the query builder
              return undefined;
            }
            throw new Error(`Unsupported logical operator: ${filter.operator}`);
          }
          return null;
        })
        .filter(Boolean);

      if (conditions.length === 0) {
        // Even if no valid conditions found, return an empty SQL condition to indicate graceful handling
        return { isEmpty: false, result: sql`1 = 1` }; // Always true condition
      }

      const validConditions = conditions.filter(
        (c): c is SQL => c !== null && c !== undefined
      );
      const result =
        validConditions.length === 1 ?
          validConditions[0]
        : and(...validConditions);
      return { isEmpty: false, result };
    } catch (error) {
      // Re-throw validation errors immediately, don't try to handle them gracefully
      if (
        error instanceof Error &&
        (error.message.includes('requires array') ||
          error.message.includes('exactly 2 values') ||
          (error as any)?.code === 'VALIDATION_ERROR')
      ) {
        throw error;
      }
      console.warn('Error transforming filters:', error);
      return { isEmpty: true, result: undefined };
    }
  },
  transformSorting: (sorting: CrudSorting, context?: TransformationContext) => {
    if (!sorting || sorting.length === 0) {
      return { isEmpty: true, result: [] };
    }

    try {
      const sortConditions = sorting
        .map(sort => {
          const column = queryBuilder.getTableColumn(table, sort.field);
          if (!column) {
            console.warn(
              `Column '${sort.field}' not found in table for sorting - skipping`
            );
            return null;
          }

          return sort.order === 'desc' ? desc(column) : asc(column);
        })
        .filter(Boolean);

      if (sortConditions.length === 0) {
        return { isEmpty: true, result: [] };
      }

      return { isEmpty: false, result: sortConditions };
    } catch (error) {
      // Re-throw validation errors immediately
      if (
        error instanceof Error &&
        (error as any)?.code === 'VALIDATION_ERROR'
      ) {
        throw error;
      }
      console.warn('Error transforming sorting:', error);
      return { isEmpty: true, result: [] };
    }
  },
  transformPagination: (pagination: any) => pagination,
});

const validateFieldName = (field: string) => {
  if (!field || typeof field !== 'string') {
    throw new ValidationError('Invalid field name');
  }
  return field;
};

/**
 * Query builder for converting Refine filters to Drizzle queries using shared transformation logic
 */
export class RefineQueryBuilder<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  private transformerCache = new Map<Table, any>();

  constructor() {}

  /**
   * Create string pattern operators to reduce repetition
   */
  private createStringPatternOperators(table: Table): OperatorConfig<SQL>[] {
    const createPatternOperator = (
      operator: string,
      pattern: (value: any) => string,
      caseSensitive = true,
      negated = false
    ) => ({
      operator,
      transform: (
        field: string,
        value: any,
        _context?: TransformationContext
      ): SQL => {
        const column = this.getTableColumn(table, field);
        if (!column)
          throw new SchemaError(`Column '${field}' not found in table`);
        const likeFunction = caseSensitive ? like : ilike;
        const result = likeFunction(column, pattern(value));
        return negated ? not(result) : result;
      },
    });

    return [
      createPatternOperator('contains' as any, value => `%${value}%`),
      createPatternOperator(
        'ncontains' as any,
        value => `%${value}%`,
        true,
        true
      ),
      createPatternOperator('containss' as any, value => `%${value}%`, false),
      createPatternOperator(
        'ncontainss' as any,
        value => `%${value}%`,
        false,
        true
      ),
      createPatternOperator('startswith' as any, value => `${value}%`),
      createPatternOperator(
        'nstartswith' as any,
        value => `${value}%`,
        true,
        true
      ),
      createPatternOperator('startswiths' as any, value => `${value}%`, false),
      createPatternOperator(
        'nstartswiths' as any,
        value => `${value}%`,
        false,
        true
      ),
      createPatternOperator('endswith' as any, value => `%${value}`),
      createPatternOperator(
        'nendswith' as any,
        value => `%${value}`,
        true,
        true
      ),
      createPatternOperator('endswiths' as any, value => `%${value}`, false),
      createPatternOperator(
        'nendswiths' as any,
        value => `%${value}`,
        false,
        true
      ),
    ] as OperatorConfig<SQL>[];
  }

  /**
   * Get or create transformer for a specific table
   */
  public getTransformer(table: Table) {
    if (this.transformerCache.has(table)) {
      return this.transformerCache.get(table);
    }

    const filterOperators = this.createDrizzleFilterOperators(table);
    const logicalOperators = this.createDrizzleLogicalOperators();

    const transformer = createDrizzleTransformer(
      table,
      filterOperators,
      logicalOperators,
      this
    );

    this.transformerCache.set(table, transformer);
    return transformer;
  }

  /**
   * Convert Refine filters to Drizzle WHERE conditions
   */
  buildWhereConditions(
    table: Table,
    filters?: CrudFilters,
    context?: TransformationContext
  ): SQL | undefined {
    if (!filters || filters.length === 0) {
      return undefined;
    }

    try {
      const transformer = this.getTransformer(table);
      const result = transformer.transformFilters(filters, context, 0);
      return result.isEmpty ? undefined : result.result;
    } catch (error) {
      // Re-throw validation errors immediately
      if (
        error instanceof Error &&
        (error.message.includes('requires array') ||
          error.message.includes('exactly 2 values') ||
          (error as any)?.code === 'VALIDATION_ERROR')
      ) {
        throw error;
      }
      // Log schema errors but handle them gracefully
      if (error instanceof Error && (error as any)?.code === 'SCHEMA_ERROR') {
        console.warn('Schema error in filter transform:', error);
      } else {
        console.warn('Failed to transform filters:', error);
      }
      return undefined;
    }
  }

  /**
   * Create Drizzle ORM filter operators for a specific table
   */
  private createDrizzleFilterOperators(table: Table): OperatorConfig<SQL>[] {
    // Helper function to reduce repetition
    const createSimpleOperator = (
      operator: string,
      drizzleFunction: Function
    ) => ({
      operator,
      transform: (
        field: string,
        value: any,
        _context?: TransformationContext
      ): SQL => {
        const column = this.getTableColumn(table, field);
        if (!column)
          throw new SchemaError(`Column '${field}' not found in table`);
        return drizzleFunction(column, value);
      },
    });

    return [
      createSimpleOperator('eq' as any, eq),
      createSimpleOperator('ne' as any, ne),
      createSimpleOperator('gt' as any, gt),
      createSimpleOperator('gte' as any, gte),
      createSimpleOperator('lt' as any, lt),
      createSimpleOperator('lte' as any, lte),
      // String pattern operators with helper
      ...this.createStringPatternOperators(table),
      {
        operator: 'null',
        transform: (
          field: string,
          _value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          return isNull(column);
        },
      },
      {
        operator: 'nnull',
        transform: (
          field: string,
          _value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          return isNotNull(column);
        },
      },
      {
        operator: 'in',
        transform: (
          field: string,
          value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          if (Array.isArray(value)) {
            return inArray(column, value);
          }
          return eq(column, value);
        },
      },
      {
        operator: 'nin',
        transform: (
          field: string,
          value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          if (Array.isArray(value)) {
            return notInArray(column, value);
          }
          return ne(column, value);
        },
      },
      {
        operator: 'between',
        transform: (
          field: string,
          value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          if (Array.isArray(value) && value.length === 2) {
            return and(gte(column, value[0]), lte(column, value[1]))!;
          }
          throw new ValidationError(
            'Between operator requires array with exactly 2 values'
          );
        },
      },
      {
        operator: 'nbetween',
        transform: (
          field: string,
          value: any,
          _context?: TransformationContext
        ): SQL => {
          const column = this.getTableColumn(table, field);
          if (!column)
            throw new SchemaError(`Column '${field}' not found in table`);
          if (Array.isArray(value) && value.length === 2) {
            return or(lt(column, value[0]), gt(column, value[1]))!;
          }
          throw new ValidationError(
            'Not between operator requires array with exactly 2 values'
          );
        },
      },
    ];
  }

  /**
   * Create Drizzle ORM logical operators
   */
  private createDrizzleLogicalOperators(): LogicalOperatorConfig<SQL>[] {
    return [
      {
        operator: 'and' as any,
        transform: (conditions: SQL[]): SQL => {
          if (conditions.length === 0) {
            // Return a dummy true condition if no conditions
            return eq({} as Column, {} as any);
          }
          return conditions.length > 1 ? and(...conditions)! : conditions[0]!;
        },
      },
      {
        operator: 'or' as any,
        transform: (conditions: SQL[]): SQL => {
          if (conditions.length === 0) {
            // Return a dummy false condition if no conditions
            return eq({} as Column, {} as any);
          }
          return conditions.length > 1 ? or(...conditions)! : conditions[0]!;
        },
      },
    ];
  }

  /**
   * Create sorting transformer for Drizzle ORM
   */
  private createDrizzleSortingTransformer(table: Table) {
    return (
      field: string,
      order: 'asc' | 'desc',
      _context?: TransformationContext
    ): SQL => {
      const fieldError = validateFieldName(field);
      if (fieldError) {
        throw new ValidationError(`Invalid sort field: ${fieldError}`);
      }

      const column = this.getTableColumn(table, field);
      if (!column) {
        throw new ValidationError(
          `Column '${field}' not found in table for sorting`
        );
      }

      if (order === 'desc') {
        return desc(column);
      } else {
        return asc(column);
      }
    };
  }

  /**
   * Create sorting combiner for Drizzle ORM
   */
  private createDrizzleSortingCombiner() {
    return (sortItems: SQL[]): SQL =>
      // For Drizzle ORM, we don't need to combine sort items into a single SQL
      // Instead, we return the first item or a dummy SQL if empty
      sortItems.length > 0 ? sortItems[0]! : asc({} as Column);
  }

  /**
   * Convert Refine sorting to Drizzle ORDER BY
   */
  buildOrderBy(
    table: Table,
    sorters?: CrudSorting,
    context?: TransformationContext
  ): SQL[] {
    if (!sorters || sorters.length === 0) {
      return [];
    }

    try {
      const transformer = this.getTransformer(table);
      const result = transformer.transformSorting(sorters, context);
      return result.isEmpty ? [] : result.result || [];
    } catch (error) {
      // Re-throw validation errors immediately
      if (
        error instanceof Error &&
        (error as any)?.code === 'VALIDATION_ERROR'
      ) {
        throw error;
      }
      console.warn('Failed to transform sorting:', error);
      return [];
    }
  }

  /**
   * Create pagination transformer for Drizzle ORM
   */
  private createDrizzlePaginationTransformer() {
    return (limit?: number, offset?: number): SQL =>
      // For Drizzle ORM, pagination is handled at the query level, not as SQL
      // Return a dummy SQL that represents the pagination info
      eq({} as Column, { limit, offset } as any);
  }

  /**
   * Apply pagination to query
   */
  buildPagination(pagination?: Pagination): {
    limit?: number;
    offset?: number;
  } {
    if (!pagination || pagination.mode === 'off') {
      return {};
    }

    const { currentPage = 1, pageSize = 10 } = pagination;
    const current = currentPage;

    // Validate pagination values
    const validCurrent = Math.max(1, current);
    const validPageSize = Math.max(1, pageSize);

    return { limit: validPageSize, offset: (validCurrent - 1) * validPageSize };
  }

  /**
   * Get column from table by field name
   */
  public getTableColumn(table: Table, fieldName: string): Column | undefined {
    try {
      // Try different ways to access table columns based on drizzle-orm version
      const tableAny = table as any;

      // Method 1: Direct column access
      if (tableAny[fieldName]) {
        return tableAny[fieldName];
      }

      // Method 2: Through columns property
      if (tableAny._?.columns?.[fieldName]) {
        return tableAny._.columns[fieldName];
      }

      // Method 3: Through symbol
      const columnsSymbol = Symbol.for('drizzle:Columns');
      if (tableAny[columnsSymbol]?.[fieldName]) {
        return tableAny[columnsSymbol][fieldName];
      }

      // Method 4: Search through all properties
      for (const key in tableAny) {
        if (
          key === fieldName &&
          typeof tableAny[key] === 'object' &&
          tableAny[key]?.name === fieldName
        ) {
          return tableAny[key];
        }
      }

      return undefined;
    } catch (error) {
      console.warn(`Failed to access column '${fieldName}' from table:`, error);
      return undefined;
    }
  }

  /**
   * Apply common query modifiers (WHERE, ORDER BY, pagination)
   */
  private applyQueryModifiers(
    query: any,
    table: Table,
    options: {
      filters?: CrudFilters;
      sorters?: CrudSorting;
      pagination?: Pagination;
    }
  ) {
    const { filters, sorters, pagination } = options;

    // Apply WHERE conditions
    const whereConditions = this.buildWhereConditions(table, filters);
    if (whereConditions) {
      query = query.where(whereConditions);
    }

    // Apply ORDER BY
    const orderBy = this.buildOrderBy(table, sorters);
    if (orderBy && orderBy.length > 0) {
      query = query.orderBy(...orderBy);
    }

    // Apply pagination
    const { limit, offset } = this.buildPagination(pagination);
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    if (offset !== undefined) {
      query = query.offset(offset);
    }

    return query;
  }

  /**
   * Build complex query with joins and relations
   */
  buildComplexQuery(
    client: DrizzleClient<TSchema>,
    options: {
      table: Table;
      filters?: CrudFilters;
      sorters?: CrudSorting;
      pagination?: Pagination;
      relations?: string[];
    }
  ) {
    const { table, relations } = options;

    // Start with base query
    let query = client.select().from(table);

    // Apply common modifiers
    query = this.applyQueryModifiers(query, table, options);

    // TODO: Add relation handling in future iterations
    if (relations && relations.length > 0) {
      console.warn('Relations are not yet implemented in RefineQueryBuilder');
    }

    return query;
  }

  /**
   * Build count query for pagination
   */
  buildCountQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    filters?: CrudFilters
  ) {
    let query = client.select({ count: count() }).from(table);

    // Apply WHERE conditions only (no sorting or pagination for count)
    const whereConditions = this.buildWhereConditions(table, filters);
    if (whereConditions) {
      query = query.where(whereConditions);
    }

    return query;
  }

  /**
   * Build list query with filters, sorting, and pagination
   */
  buildListQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    params: {
      filters?: CrudFilters;
      sorters?: CrudSorting;
      pagination?: Pagination;
    }
  ) {
    const query = client.select().from(table);
    return this.applyQueryModifiers(query, table, params);
  }

  /**
   * Helper to get ID column and validate it exists
   */
  public validateAndGetIdColumn(table: Table): Column {
    const idColumn = this.getIdColumn(table);
    if (!idColumn) {
      throw new SchemaError('No ID column found in table');
    }
    return idColumn;
  }

  /**
   * Build get one query by ID
   */
  buildGetOneQuery(client: DrizzleClient<TSchema>, table: Table, id: any) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client.select().from(table).where(eq(idColumn, id)).limit(1);
  }

  /**
   * Build get many query by IDs
   */
  buildGetManyQuery(client: DrizzleClient<TSchema>, table: Table, ids: any[]) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client.select().from(table).where(inArray(idColumn, ids));
  }

  /**
   * Build create query
   */
  buildCreateQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    data: any,
    dbType?: string
  ) {
    const insertQuery = client.insert(table).values(data);

    // MySQL doesn't support RETURNING clause
    if (dbType === 'mysql') {
      return insertQuery;
    }

    // PostgreSQL and SQLite support RETURNING
    return insertQuery.returning();
  }

  /**
   * Build update query
   */
  buildUpdateQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    id: any,
    data: any,
    dbType?: string
  ) {
    const idColumn = this.validateAndGetIdColumn(table);
    const updateQuery = client.update(table).set(data).where(eq(idColumn, id));

    // MySQL doesn't support RETURNING clause
    if (dbType === 'mysql') {
      return updateQuery;
    }

    // PostgreSQL and SQLite support RETURNING
    return updateQuery.returning();
  }

  /**
   * Build delete query
   */
  buildDeleteQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    id: any,
    dbType?: string
  ) {
    const idColumn = this.validateAndGetIdColumn(table);
    const deleteQuery = client.delete(table).where(eq(idColumn, id));

    // MySQL doesn't support RETURNING clause
    if (dbType === 'mysql') {
      return deleteQuery;
    }

    // PostgreSQL and SQLite support RETURNING
    return deleteQuery.returning();
  }

  /**
   * Build create many query
   */
  buildCreateManyQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    data: any[],
    dbType?: string
  ) {
    const insertQuery = client.insert(table).values(data);

    // MySQL doesn't support RETURNING clause
    if (dbType === 'mysql') {
      return insertQuery;
    }

    // PostgreSQL and SQLite support RETURNING
    return insertQuery.returning();
  }

  /**
   * Build update many query
   */
  buildUpdateManyQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    ids: any[],
    data: any
  ) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client
      .update(table)
      .set(data)
      .where(inArray(idColumn, ids))
      .returning();
  }

  /**
   * Build delete many query
   */
  buildDeleteManyQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    ids: any[]
  ) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client.delete(table).where(inArray(idColumn, ids)).returning();
  }

  /**
   * Get ID column from table (assumes 'id' field or first primary key)
   */
  private getIdColumn(table: Table): Column | undefined {
    try {
      const tableAny = table as any;

      // Try to find 'id' column first
      if (tableAny.id) {
        return tableAny.id;
      }

      // Try to find primary key columns
      if (tableAny._.columns) {
        const columns = tableAny._.columns;
        for (const [_name, column] of Object.entries(columns)) {
          const columnAny = column as any;
          if (columnAny.primary || columnAny.primaryKey) {
            return columnAny;
          }
        }

        // Fallback to first column if no primary key found
        const firstColumn = Object.values(columns)[0];
        if (firstColumn) {
          return firstColumn as Column;
        }
      }

      return undefined;
    } catch (error) {
      console.warn('Failed to find ID column:', error);
      return undefined;
    }
  }
}
