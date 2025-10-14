import type { SqlResult, SqlAffected } from './client';

/**
 * Deserialize SQL result to JavaScript objects
 */
export function deserializeSqlResult({ columnNames, rows }: SqlResult) {
  return rows.map(row =>
    Object.fromEntries(
      columnNames.map((name, index) => [name, row[index]] as const)
    )
  );
}

/**
 * Common utility functions collection
 */

/**
 * Converts object-based query results to row-based format.
 * Used by adapters that return results as arrays of objects.
 */
export function convertObjectRowsToArrayRows(
  objectRows: Record<string, any>[],
  columnNames: string[]
): unknown[][] {
  const rows: unknown[][] = [];
  for (const item of objectRows) {
    const row: unknown[] = [];
    for (const key of columnNames) {
      row.push(item[key]);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Normalizes lastInsertRowid/lastInsertId property names across different SQLite implementations.
 */
export function normalizeLastInsertId(result: any): number | undefined {
  return result.lastInsertRowid ?? result.lastInsertId ?? result.last_row_id;
}

/**
 * Creates a standardized SqlAffected response from various SQLite result formats.
 */
export function createSqlAffected(result: any): SqlAffected {
  return {
    changes: result.changes,
    lastInsertId: normalizeLastInsertId(result),
  };
}

/**
 * Determines if a SQL query is a SELECT statement.
 */
export function isSelectQuery(sql: string): boolean {
  return sql.trim().toLowerCase().startsWith('select');
}

/**
 * Method decorator for caching method results (new standard decorators)
 */
export function cached<T, A extends any[], R>(
  target: (this: T, ...args: A) => R,
  _context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>
) {
  const cache = new Map<string, R>();

  return function (this: T, ...args: A): R {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    const result = target.call(this, ...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Function wrapper for error handling with consistent error messages
 */
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  errorMessage?: string
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      const functionName = fn.name || 'anonymous';
      const finalMessage = errorMessage || `Error in ${functionName}`;
      throw new Error(
        `${finalMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }) as T;
}

/**
 * Method decorator for error handling with consistent error messages (for class methods only)
 */
export function handleErrors(errorMessage?: string) {
  return function (target: any, context: ClassMethodDecoratorContext) {
    return async function (this: any, ...args: any[]) {
      try {
        return await target.call(this, ...args);
      } catch (error) {
        const finalMessage = errorMessage || `Error in ${String(context.name)}`;
        throw new Error(
          `${finalMessage}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };
  };
}

/**
 * Method decorator for logging method calls with execution time
 */
export function logExecution<T, A extends any[], R>(
  target: (this: T, ...args: A) => R | Promise<R>,
  context: ClassMethodDecoratorContext<
    T,
    (this: T, ...args: A) => R | Promise<R>
  >
) {
  return async function (this: T, ...args: A): Promise<R> {
    const methodName = String(context.name);
    const start = performance.now();

    try {
      const result = await target.call(this, ...args);
      const duration = performance.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ ${methodName} completed in ${duration.toFixed(2)}ms`);
      }
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      if (process.env.NODE_ENV === 'development') {
        console.error(
          `❌ ${methodName} failed after ${duration.toFixed(2)}ms:`,
          error
        );
      }
      throw error;
    }
  };
}

/**
 * Method decorator for validating parameters
 */
export function validateParams<T, A extends any[], R>(
  validator: (args: A) => boolean | string
) {
  return function (
    target: (this: T, ...args: A) => R,
    context: ClassMethodDecoratorContext<T, (this: T, ...args: A) => R>
  ) {
    return function (this: T, ...args: A): R {
      const validation = validator(args);
      if (validation !== true) {
        const methodName = String(context.name);
        const message =
          typeof validation === 'string' ? validation : (
            `Invalid parameters for ${methodName}`
          );
        throw new Error(message);
      }
      return target.call(this, ...args);
    };
  };
}

/**
 * Method decorator for database operations with automatic error handling
 */
export function dbOperation<T, A extends any[], R>(
  operationType: 'query' | 'execute' = 'query'
) {
  return function (
    target: (this: T, ...args: A) => R | Promise<R>,
    context: ClassMethodDecoratorContext<
      T,
      (this: T, ...args: A) => R | Promise<R>
    >
  ) {
    return async function (this: T, ...args: A): Promise<R> {
      try {
        // Auto-resolve client if available
        if (typeof (this as any).resolveClient === 'function') {
          await (this as any).resolveClient();
        }

        const result = await target.call(this, ...args);
        return result;
      } catch (error) {
        const methodName = String(context.name);
        throw new Error(
          `Database ${operationType} failed in ${methodName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    };
  };
}

/**
 * Higher-order function to wrap adapter methods with error handling
 */
export function withAdapterErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  operationType: 'query' | 'execute' | 'batch' = 'query'
): T {
  return (async (...args: Parameters<T>) => {
    try {
      const result = await fn(...args);
      return result;
    } catch (error) {
      const functionName = fn.name || 'unknown';
      throw new Error(
        `Adapter ${operationType} failed in ${functionName}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }) as T;
}

/**
 * Higher-order function to wrap methods with client initialization check
 */
export function withClientCheck<T extends (...args: any[]) => any>(
  fn: T,
  getClient: () => any
): T {
  return ((...args: Parameters<T>) => {
    const client = getClient();
    if (!client) throw new Error('Client not initialized');
    return fn(...args);
  }) as T;
}

/**
 * Shared WHERE condition builder for SQL queries
 * This function is used by SelectChain, UpdateChain, and DeleteChain
 * to build WHERE conditions consistently across different query types.
 */
export function buildWhereCondition(
  column: string,
  operator: string,
  value: any
): { sql: string; args: any[] } {
  const normalizedOperator = operator.toLowerCase();

  switch (normalizedOperator) {
    case 'eq':
    case '=':
      return { sql: `${column} = ?`, args: [value] };

    case 'ne':
    case '!=':
      return { sql: `${column} != ?`, args: [value] };

    case 'gt':
    case '>':
      return { sql: `${column} > ?`, args: [value] };

    case 'gte':
    case '>=':
      return { sql: `${column} >= ?`, args: [value] };

    case 'lt':
    case '<':
      return { sql: `${column} < ?`, args: [value] };

    case 'lte':
    case '<=':
      return { sql: `${column} <= ?`, args: [value] };

    case 'like':
      return { sql: `${column} LIKE ?`, args: [`%${value}%`] };

    case 'ilike':
      // SQLite uses COLLATE NOCASE for case-insensitive matching
      return { sql: `${column} LIKE ? COLLATE NOCASE`, args: [`%${value}%`] };

    case 'notlike':
      return { sql: `${column} NOT LIKE ?`, args: [`%${value}%`] };

    case 'in':
      if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        return { sql: `${column} IN (${placeholders})`, args: value };
      }
      return { sql: `${column} = ?`, args: [value] };

    case 'notin':
      if (Array.isArray(value)) {
        const placeholders = value.map(() => '?').join(', ');
        return { sql: `${column} NOT IN (${placeholders})`, args: value };
      }
      return { sql: `${column} != ?`, args: [value] };

    case 'isnull':
    case 'null':
      return { sql: `${column} IS NULL`, args: [] };

    case 'isnotnull':
    case 'notnull':
      return { sql: `${column} IS NOT NULL`, args: [] };

    case 'between':
      if (Array.isArray(value) && value.length === 2) {
        return { sql: `${column} BETWEEN ? AND ?`, args: value };
      }
      throw new Error('Between operator requires array with exactly 2 values');

    case 'notbetween':
      if (Array.isArray(value) && value.length === 2) {
        return { sql: `${column} NOT BETWEEN ? AND ?`, args: value };
      }
      throw new Error(
        'Not between operator requires array with exactly 2 values'
      );

    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}
