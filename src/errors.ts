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

/**
 * Error thrown when optimistic lock conflict occurs
 */
export class OptimisticLockError extends RefineSQLError {
  constructor(
    public resource: string,
    public id: any,
    public expectedVersion: number | string,
    public currentVersion?: number | string,
  ) {
    super(
      `Optimistic lock conflict: ${resource}#${id} ` +
        `(expected version ${expectedVersion}, current version ${currentVersion})`,
      'OPTIMISTIC_LOCK_ERROR',
      { resource, id, expectedVersion, currentVersion },
    );
    this.name = 'OptimisticLockError';
  }
}

/**
 * Error thrown when ID type conversion fails
 */
export class IdTypeConversionError extends RefineSQLError {
  constructor(
    public resource: string,
    public id: any,
    public expectedType: string,
    public reason?: string,
  ) {
    super(
      `Failed to convert ID "${id}" to ${expectedType} for resource "${resource}"` +
        (reason ? `: ${reason}` : ''),
      'ID_TYPE_CONVERSION_ERROR',
      { resource, id, expectedType, reason },
    );
    this.name = 'IdTypeConversionError';
  }
}

/**
 * Error thrown when access is denied by security rules
 */
export class AccessDeniedError extends RefineSQLError {
  constructor(
    public operation: string,
    public resource?: string,
    public reason?: string,
  ) {
    super(
      `Access denied for operation "${operation}"` +
        (resource ? ` on resource "${resource}"` : '') +
        (reason ? `: ${reason}` : ''),
      'ACCESS_DENIED',
      { operation, resource, reason },
    );
    this.name = 'AccessDeniedError';
  }
}

/**
 * Error thrown when a field value is invalid
 */
export class InvalidFieldValueError extends RefineSQLError {
  constructor(
    public resource: string,
    public field: string,
    public value: any,
    public expectedType?: string,
    public constraints?: Record<string, any>,
  ) {
    super(
      `Invalid value for field "${field}" in "${resource}": ` +
        `received ${typeof value} "${value}"` +
        (expectedType ? `, expected ${expectedType}` : ''),
      'INVALID_FIELD_VALUE',
      { resource, field, value, expectedType, constraints },
    );
    this.name = 'InvalidFieldValueError';
  }
}

/**
 * Error thrown when a required field is missing
 */
export class MissingRequiredFieldError extends RefineSQLError {
  constructor(
    public resource: string,
    public field: string,
    public operation: string,
  ) {
    super(
      `Missing required field "${field}" for ${operation} operation on "${resource}"`,
      'MISSING_REQUIRED_FIELD',
      { resource, field, operation },
    );
    this.name = 'MissingRequiredFieldError';
  }
}

/**
 * Error thrown when a feature is not enabled
 */
export class FeatureNotEnabledError extends RefineSQLError {
  constructor(
    public feature: string,
    public hint?: string,
  ) {
    super(
      `Feature "${feature}" is not enabled. ` +
        (hint || `Set features.${feature}.enabled = true in configuration.`),
      'FEATURE_NOT_ENABLED',
      { feature, hint },
    );
    this.name = 'FeatureNotEnabledError';
  }
}

/**
 * Error thrown when relation query fails
 */
export class RelationQueryError extends RefineSQLError {
  constructor(
    public resource: string,
    public relation: string,
    public reason: string,
  ) {
    super(
      `Failed to load relation "${relation}" on "${resource}": ${reason}`,
      'RELATION_QUERY_ERROR',
      { resource, relation, reason },
    );
    this.name = 'RelationQueryError';
  }
}
