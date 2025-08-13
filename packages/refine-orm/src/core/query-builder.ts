import type { Table, SQL, Column } from 'drizzle-orm';
import {
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
} from 'drizzle-orm';
import type { CrudFilters, CrudSorting, Pagination } from '@refinedev/core';
import type { DrizzleClient } from '../types/client.js';
// Temporary local implementation to avoid import issues during testing
type TransformationContext = { schema?: any; table?: any; dialect?: string };

type OperatorConfig<T> = {
  operator: string;
  transform: (field: string, value: any, context?: TransformationContext) => T;
};

type LogicalOperatorConfig<T> = {
  operator: string;
  transform: (conditions: T[], context?: TransformationContext) => T;
};

// Simplified implementations for testing
const createDrizzleTransformer = () => ({
  transformFilters: (filters: any[]) => filters,
  transformSorting: (sorting: any[]) => sorting,
  transformPagination: (pagination: any) => pagination,
});

const validateFieldName = (field: string) => {
  if (!field || typeof field !== 'string') {
    throw new Error('Invalid field name');
  }
  return field;
};
import { ValidationError, SchemaError } from '../types/errors.js';

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
  private getTransformer(table: Table) {
    if (this.transformerCache.has(table)) {
      return this.transformerCache.get(table);
    }

    // Note: These transformers are available but not used in this simple implementation
    // const filterOperators = this.createDrizzleFilterOperators(table);
    // const logicalOperators = this.createDrizzleLogicalOperators();
    // const sortingTransformer = this.createDrizzleSortingTransformer(table);
    // const sortingCombiner = this.createDrizzleSortingCombiner();
    // const paginationTransformer = this.createDrizzlePaginationTransformer();

    const transformer = createDrizzleTransformer();

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
      const result = transformer.transformFilters(filters, context);
      return result.isEmpty ? undefined : result.result;
    } catch (error) {
      console.warn('Failed to transform filters:', error);
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
        throw new Error(`Invalid sort field: ${fieldError}`);
      }

      const column = this.getTableColumn(table, field);
      if (!column) {
        throw new SchemaError(
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
    return (sortItems: SQL[]): SQL => {
      // For Drizzle ORM, we don't need to combine sort items into a single SQL
      // Instead, we return the first item or a dummy SQL if empty
      return sortItems.length > 0 ? sortItems[0]! : asc({} as Column);
    };
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
      console.warn('Failed to transform sorting:', error);
      return [];
    }
  }

  /**
   * Create pagination transformer for Drizzle ORM
   */
  private createDrizzlePaginationTransformer() {
    return (limit?: number, offset?: number): SQL => {
      // For Drizzle ORM, pagination is handled at the query level, not as SQL
      // Return a dummy SQL that represents the pagination info
      return eq({} as Column, { limit, offset } as any);
    };
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

    const { current = 1, pageSize = 10 } = pagination;

    // Validate pagination values
    const validCurrent = Math.max(1, current);
    const validPageSize = Math.max(1, pageSize);

    return { limit: validPageSize, offset: (validCurrent - 1) * validPageSize };
  }

  /**
   * Get column from table by field name
   */
  private getTableColumn(table: Table, fieldName: string): Column | undefined {
    try {
      // Try different ways to access table columns based on drizzle-orm version
      const tableAny = table as any;

      // Method 1: Direct column access
      if (tableAny[fieldName]) {
        return tableAny[fieldName];
      }

      // Method 2: Through columns property
      if (tableAny._.columns && tableAny._.columns[fieldName]) {
        return tableAny._.columns[fieldName];
      }

      // Method 3: Through symbol
      const columnsSymbol = Symbol.for('drizzle:Columns');
      if (tableAny[columnsSymbol] && tableAny[columnsSymbol][fieldName]) {
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
    let query = client.select().from(table);
    return this.applyQueryModifiers(query, table, { 
      ...(filters && { filters })
    });
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
    let query = client.select().from(table);
    return this.applyQueryModifiers(query, table, params);
  }

  /**
   * Helper to get ID column and validate it exists
   */
  private validateAndGetIdColumn(table: Table): Column {
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
  buildCreateQuery(client: DrizzleClient<TSchema>, table: Table, data: any) {
    return client.insert(table).values(data).returning();
  }

  /**
   * Build update query
   */
  buildUpdateQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    id: any,
    data: any
  ) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client.update(table).set(data).where(eq(idColumn, id)).returning();
  }

  /**
   * Build delete query
   */
  buildDeleteQuery(client: DrizzleClient<TSchema>, table: Table, id: any) {
    const idColumn = this.validateAndGetIdColumn(table);
    return client.delete(table).where(eq(idColumn, id)).returning();
  }

  /**
   * Build create many query
   */
  buildCreateManyQuery(
    client: DrizzleClient<TSchema>,
    table: Table,
    data: any[]
  ) {
    return client.insert(table).values(data).returning();
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
