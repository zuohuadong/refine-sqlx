/**
 * Base error class for refine-sqlx
 */
export class RefineSQLError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'RefineSQLError';
  }
}

/**
 * Error thrown when a table is not found in schema
 */
export class TableNotFoundError extends RefineSQLError {
  constructor(tableName: string) {
    super(`Table "${tableName}" not found in schema`, 'TABLE_NOT_FOUND', {
      tableName,
    });
    this.name = 'TableNotFoundError';
  }
}

/**
 * Error thrown when a column is not found in table
 */
export class ColumnNotFoundError extends RefineSQLError {
  constructor(columnName: string, tableName: string) {
    super(
      `Column "${columnName}" not found in table "${tableName}"`,
      'COLUMN_NOT_FOUND',
      { columnName, tableName },
    );
    this.name = 'ColumnNotFoundError';
  }
}

/**
 * Error thrown when a record is not found
 */
export class RecordNotFoundError extends RefineSQLError {
  constructor(resource: string, id: any) {
    super(`Record with id ${id} not found in ${resource}`, 'RECORD_NOT_FOUND', {
      resource,
      id,
    });
    this.name = 'RecordNotFoundError';
  }
}

/**
 * Error thrown when a database operation fails
 */
export class DatabaseOperationError extends RefineSQLError {
  constructor(operation: string, originalError: Error) {
    super(
      `Database operation "${operation}" failed: ${originalError.message}`,
      'DATABASE_OPERATION_ERROR',
      { operation, originalError },
    );
    this.name = 'DatabaseOperationError';
  }
}

/**
 * Error thrown when an unsupported operator is used
 */
export class UnsupportedOperatorError extends RefineSQLError {
  constructor(operator: string) {
    super(`Unsupported filter operator: ${operator}`, 'UNSUPPORTED_OPERATOR', {
      operator,
    });
    this.name = 'UnsupportedOperatorError';
  }
}

/**
 * Error thrown when runtime is not supported
 */
export class UnsupportedRuntimeError extends RefineSQLError {
  constructor(runtime: string) {
    super(`Unsupported runtime: ${runtime}`, 'UNSUPPORTED_RUNTIME', {
      runtime,
    });
    this.name = 'UnsupportedRuntimeError';
  }
}

/**
 * Error thrown when configuration is invalid
 */
export class InvalidConfigurationError extends RefineSQLError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_CONFIGURATION', details);
    this.name = 'InvalidConfigurationError';
  }
}
