// TypeScript 5.0 Decorators for error handling
function ErrorLogger(
  originalMethod: any,
  context: ClassMethodDecoratorContext
) {
  return function (this: any, ...args: any[]) {
    try {
      const result = originalMethod.apply(this, args);
      return result;
    } catch (error) {
      console.error(
        `[${this.constructor.name}] Error in ${String(context.name)}:`,
        error
      );
      throw error;
    }
  };
}

function ErrorCode(code: string) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>
  ): T {
    return class extends target {
      errorCode = code;
    } as T;
  };
}

function StatusCode(statusCode: number) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>
  ): T {
    return class extends target {
      httpStatusCode = statusCode;
    } as T;
  };
}

function Recoverable(recoverable: boolean = true) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>
  ): T {
    return class extends target {
      isRecoverable() {
        return recoverable;
      }
    } as T;
  };
}

function ErrorMetadata(metadata: Record<string, any>) {
  return function <T extends new (...args: any[]) => any>(
    target: T,
    _context: ClassDecoratorContext<T>
  ): T {
    return class extends target {
      metadata = metadata;
    } as T;
  };
}

// Base error class for all RefineOrm errors
export abstract class RefineOrmError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public override readonly cause?: Error,
    public readonly context?: Record<string, any>
  ) {
    super(message);
    this.name = this.constructor.name;

    // Maintain proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Check if the error is recoverable (can be retried or fixed by user action)
   */
  isRecoverable(): boolean {
    return false; // Default to not recoverable
  }

  /**
   * Get a developer-friendly error message with context
   */
  getDetailedMessage(): string {
    let message = this.message;

    if (this.context) {
      const contextInfo = Object.entries(this.context)
        .filter(([_, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join(', ');

      if (contextInfo) {
        message += ` (Context: ${contextInfo})`;
      }
    }

    if (this.cause) {
      message += ` (Caused by: ${this.cause.message})`;
    }

    return message;
  }

  /**
   * Get suggested solutions for this error
   */
  abstract getSuggestions(): string[];

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      detailedMessage: this.getDetailedMessage(),
      code: this.code,
      statusCode: this.statusCode,
      context: this.context,
      suggestions: this.getSuggestions(),
      isRecoverable:
        typeof this.isRecoverable === 'function' ? this.isRecoverable() : false,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

// Connection related errors
@ErrorCode('CONNECTION_ERROR')
@StatusCode(500)
@Recoverable(true)
@ErrorMetadata({ category: 'infrastructure', severity: 'high' })
export class ConnectionError extends RefineOrmError {
  readonly code = 'CONNECTION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Connection failed: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check if the database server is running and accessible',
      'Verify connection string format and credentials',
      'Ensure network connectivity to the database host',
      'Check firewall settings and port accessibility',
    ];

    if (this.cause?.message.includes('ECONNREFUSED')) {
      suggestions.unshift(
        "Database server is not accepting connections - check if it's running"
      );
    }

    if (this.cause?.message.includes('ENOTFOUND')) {
      suggestions.unshift(
        'Database host not found - verify the hostname or IP address'
      );
    }

    if (this.cause?.message.includes('ETIMEDOUT')) {
      suggestions.unshift(
        'Connection timed out - check network connectivity and server responsiveness'
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Connection errors are usually recoverable with retry
  }
}

// Query execution errors
@ErrorCode('QUERY_ERROR')
@StatusCode(400)
@Recoverable(false)
@ErrorMetadata({ category: 'query', severity: 'medium' })
export class QueryError extends RefineOrmError {
  readonly code = 'QUERY_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly query?: string,
    public readonly params?: any[],
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Query execution failed: ${message}`, cause, {
      ...context,
      query,
      params,
    });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check SQL syntax and query structure',
      'Verify table and column names exist in the database',
      'Ensure parameter types match expected column types',
      'Check for proper escaping of special characters',
    ];

    if (this.cause?.message.includes('syntax')) {
      suggestions.unshift(
        'SQL syntax error - review query structure and keywords'
      );
    }

    if (this.cause?.message.includes('does not exist')) {
      suggestions.unshift(
        'Referenced table or column does not exist - check schema'
      );
    }

    if (this.cause?.message.includes('permission')) {
      suggestions.unshift(
        'Insufficient database permissions - check user privileges'
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    // Syntax errors are not recoverable, but connection issues might be
    return !this.cause?.message.toLowerCase().includes('syntax');
  }
}

// Data validation errors
@ErrorCode('VALIDATION_ERROR')
@StatusCode(422)
@Recoverable(true)
@ErrorMetadata({ category: 'validation', severity: 'low' })
export class ValidationError extends RefineOrmError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 422;

  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: any,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Validation failed: ${message}`, cause, { ...context, field, value });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check data types and formats match schema requirements',
      'Verify required fields are provided',
      'Ensure values are within acceptable ranges or constraints',
      'Review field validation rules in your schema',
    ];

    if (this.field) {
      suggestions.unshift(`Fix validation issue with field '${this.field}'`);
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Validation errors can be fixed by correcting the data
  }
}

// Transaction related errors
export class TransactionError extends RefineOrmError {
  readonly code = 'TRANSACTION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Transaction failed: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check for deadlocks or lock timeouts',
      'Ensure transaction operations are properly ordered',
      'Consider reducing transaction scope or duration',
      'Verify database supports the transaction isolation level',
    ];

    if (this.cause?.message.includes('deadlock')) {
      suggestions.unshift(
        'Deadlock detected - retry the transaction or reorder operations'
      );
    }

    if (this.cause?.message.includes('timeout')) {
      suggestions.unshift(
        'Transaction timeout - consider breaking into smaller transactions'
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    // Deadlocks and timeouts are recoverable with retry
    const message = this.cause?.message.toLowerCase() || '';
    return message.includes('deadlock') || message.includes('timeout');
  }
}

// Configuration errors
@ErrorCode('CONFIGURATION_ERROR')
@StatusCode(500)
@Recoverable(false)
@ErrorMetadata({ category: 'configuration', severity: 'high' })
export class ConfigurationError extends RefineOrmError {
  readonly code = 'CONFIGURATION_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Configuration error: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    return [
      'Review configuration parameters and their formats',
      'Check environment variables are properly set',
      'Verify required dependencies are installed',
      'Ensure configuration matches your database type',
      'Consult documentation for correct configuration examples',
    ];
  }

  isRecoverable(): boolean {
    return false; // Configuration errors require code changes
  }
}

// Schema related errors
export class SchemaError extends RefineOrmError {
  readonly code = 'SCHEMA_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Schema error: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    return [
      'Verify Drizzle schema definitions match database structure',
      'Check table and column names are correctly defined',
      'Ensure relationships are properly configured',
      'Run database migrations if schema has changed',
      'Validate schema types match database column types',
    ];
  }

  isRecoverable(): boolean {
    return false; // Schema errors require code or database changes
  }
}

// Type inference errors
export class TypeInferenceError extends RefineOrmError {
  readonly code = 'TYPE_INFERENCE_ERROR';
  readonly statusCode = 500;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Type inference failed: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    return [
      'Ensure Drizzle schema is properly typed',
      'Check TypeScript configuration and version compatibility',
      'Verify generic type parameters are correctly specified',
      'Consider explicit type annotations where inference fails',
      'Update to latest version of drizzle-orm for better type support',
    ];
  }

  isRecoverable(): boolean {
    return false; // Type errors require code changes
  }
}

// Resource not found errors
export class ResourceNotFoundError extends RefineOrmError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(
    resource: string,
    id?: any,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(
      `Resource '${resource}' not found${id ? ` with id: ${id}` : ''}`,
      cause,
      { ...context, resource, id }
    );
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Verify the resource identifier is correct',
      'Check if the resource was deleted or moved',
      'Ensure you have permission to access this resource',
      'Confirm the resource exists in the current database',
    ];

    if (this.context?.['id']) {
      suggestions.unshift(
        `Check if record with ID '${this.context['id']}' exists in table '${this.context['resource']}'`
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // User can provide a different ID or create the resource
  }
}

// Constraint violation errors
export class ConstraintViolationError extends RefineOrmError {
  readonly code = 'CONSTRAINT_VIOLATION';
  readonly statusCode = 409;

  constructor(
    message: string,
    public readonly constraint?: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Constraint violation: ${message}`, cause, {
      ...context,
      constraint,
    });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check for duplicate values in unique fields',
      'Verify foreign key references exist',
      'Ensure required fields are not null',
      'Review database constraints and their requirements',
    ];

    if (this.constraint) {
      suggestions.unshift(`Fix constraint violation for '${this.constraint}'`);
    }

    const message = this.cause?.message.toLowerCase() || '';
    if (message.includes('unique')) {
      suggestions.unshift(
        'Unique constraint violation - use different values for unique fields'
      );
    }
    if (message.includes('foreign key')) {
      suggestions.unshift(
        'Foreign key constraint violation - ensure referenced records exist'
      );
    }
    if (message.includes('not null')) {
      suggestions.unshift(
        'Not null constraint violation - provide values for required fields'
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // User can fix the data to satisfy constraints
  }
}

// Timeout errors
export class TimeoutError extends RefineOrmError {
  readonly code = 'TIMEOUT_ERROR';
  readonly statusCode = 408;

  constructor(
    operation: string,
    timeout: number,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Operation '${operation}' timed out after ${timeout}ms`, cause, {
      ...context,
      operation,
      timeout,
    });
  }

  getSuggestions(): string[] {
    return [
      'Increase timeout configuration if appropriate',
      'Optimize query performance with indexes',
      'Check database server performance and load',
      'Consider breaking large operations into smaller chunks',
      'Verify network connectivity is stable',
    ];
  }

  isRecoverable(): boolean {
    return true; // Timeouts can often be retried
  }
}

// Permission/Authorization errors
export class AuthorizationError extends RefineOrmError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;

  constructor(message: string, cause?: Error, context?: Record<string, any>) {
    super(`Authorization failed: ${message}`, cause, context);
  }

  getSuggestions(): string[] {
    return [
      'Check database user permissions and roles',
      'Verify authentication credentials are correct',
      'Ensure user has required privileges for the operation',
      'Contact database administrator to grant necessary permissions',
      'Review security policies and access controls',
    ];
  }

  isRecoverable(): boolean {
    return false; // Authorization errors require permission changes
  }
}

// Driver/Runtime errors
export class DriverError extends RefineOrmError {
  readonly code = 'DRIVER_ERROR';
  readonly statusCode = 500;

  constructor(
    driverName: string,
    message: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Driver '${driverName}' error: ${message}`, cause, {
      ...context,
      driverName,
    });
  }

  getSuggestions(): string[] {
    const driverName = this.context?.['driverName'];
    const suggestions = [
      'Ensure the database driver is properly installed',
      'Check driver version compatibility',
      'Verify runtime environment supports the driver',
      'Review driver-specific configuration requirements',
    ];

    if (driverName) {
      suggestions.unshift(`Install missing driver: npm install ${driverName}`);
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return false; // Driver errors require installation or configuration changes
  }
}

// Migration errors
export class MigrationError extends RefineOrmError {
  readonly code = 'MIGRATION_ERROR';
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly migrationName?: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Migration failed: ${message}`, cause, { ...context, migrationName });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check migration script syntax and logic',
      'Verify database schema state before migration',
      'Ensure migration dependencies are satisfied',
      'Review migration rollback procedures',
      'Check for conflicting schema changes',
    ];

    if (this.migrationName) {
      suggestions.unshift(`Fix issues in migration '${this.migrationName}'`);
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Migrations can often be fixed and retried
  }
}

// Relationship/Association errors
export class RelationshipError extends RefineOrmError {
  readonly code = 'RELATIONSHIP_ERROR';
  readonly statusCode = 400;

  constructor(
    message: string,
    public readonly relationshipType?: string,
    public readonly sourceTable?: string,
    public readonly targetTable?: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Relationship error: ${message}`, cause, {
      ...context,
      relationshipType,
      sourceTable,
      targetTable,
    });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Verify relationship configuration in schema',
      'Check foreign key constraints are properly defined',
      'Ensure related tables exist and are accessible',
      'Review relationship mapping and join conditions',
      'Validate relationship data integrity',
    ];

    if (this.sourceTable && this.targetTable) {
      suggestions.unshift(
        `Check relationship between '${this.sourceTable}' and '${this.targetTable}'`
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Relationship issues can often be fixed with correct data
  }
}

// Serialization/Deserialization errors
export class SerializationError extends RefineOrmError {
  readonly code = 'SERIALIZATION_ERROR';
  readonly statusCode = 500;

  constructor(
    message: string,
    public readonly dataType?: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Serialization failed: ${message}`, cause, { ...context, dataType });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check data format and structure',
      'Verify serialization/deserialization logic',
      'Ensure data types are compatible',
      'Review custom serializers if used',
      'Validate JSON structure and encoding',
    ];

    if (this.dataType) {
      suggestions.unshift(
        `Fix serialization issue with data type '${this.dataType}'`
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Serialization issues can be fixed with correct data format
  }
}

// Pool/Connection management errors
export class PoolError extends RefineOrmError {
  readonly code = 'POOL_ERROR';
  readonly statusCode = 503;

  constructor(
    message: string,
    public readonly poolSize?: number,
    public readonly activeConnections?: number,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(`Connection pool error: ${message}`, cause, {
      ...context,
      poolSize,
      activeConnections,
    });
  }

  getSuggestions(): string[] {
    const suggestions = [
      'Check connection pool configuration',
      'Monitor connection usage patterns',
      'Consider increasing pool size if needed',
      'Ensure connections are properly released',
      'Review connection timeout settings',
    ];

    if (this.poolSize && this.activeConnections) {
      suggestions.unshift(
        `Pool exhausted: ${this.activeConnections}/${this.poolSize} connections in use`
      );
    }

    return suggestions;
  }

  isRecoverable(): boolean {
    return true; // Pool errors can often be resolved by waiting or adjusting configuration
  }
}

// Error handler utility class
export class ErrorHandler {
  /**
   * Convert unknown errors to RefineOrmError instances
   */
  static handle(error: unknown, context?: Record<string, any>): RefineOrmError {
    if (error instanceof RefineOrmError) {
      return error;
    }

    if (error instanceof Error) {
      return ErrorHandler.categorizeError(error, context);
    }

    return new QueryError(
      'Unknown error occurred',
      undefined,
      undefined,
      undefined,
      context
    );
  }

  /**
   * Categorize generic errors into specific RefineOrmError types
   */
  private static categorizeError(
    error: Error,
    context?: Record<string, any>
  ): RefineOrmError {
    const message = error.message.toLowerCase();

    // Network/Connection errors (most specific first)
    if (message.includes('econnrefused')) {
      return new ConnectionError(
        'Connection refused by server',
        error,
        context
      );
    }
    if (message.includes('enotfound')) {
      return new ConnectionError('Host not found', error, context);
    }
    if (message.includes('etimedout')) {
      return new ConnectionError('Connection timed out', error, context);
    }
    if (message.includes('connection') || message.includes('connect')) {
      return new ConnectionError(error.message, error, context);
    }

    // Driver/Module errors
    if (
      message.includes('cannot find module') ||
      message.includes('module not found')
    ) {
      const driverMatch = message.match(/module ['"]([^'"]+)['"]/);
      const driverName = driverMatch ? driverMatch[1] : 'unknown';
      return new DriverError(
        driverName ?? 'unknown',
        error.message,
        error,
        context
      );
    }

    // Database constraint violations (specific types)
    if (
      message.includes('duplicate key') ||
      message.includes('unique constraint')
    ) {
      return new ConstraintViolationError(
        error.message,
        'unique',
        error,
        context
      );
    }
    if (message.includes('foreign key constraint')) {
      return new ConstraintViolationError(
        error.message,
        'foreign_key',
        error,
        context
      );
    }
    if (message.includes('not null constraint')) {
      return new ConstraintViolationError(
        error.message,
        'not_null',
        error,
        context
      );
    }
    if (message.includes('check constraint')) {
      return new ConstraintViolationError(
        error.message,
        'check',
        error,
        context
      );
    }
    if (message.includes('constraint')) {
      return new ConstraintViolationError(
        error.message,
        undefined,
        error,
        context
      );
    }

    // Transaction-specific errors
    if (message.includes('deadlock')) {
      return new TransactionError('Deadlock detected', error, context);
    }
    if (
      message.includes('lock timeout') ||
      message.includes('lock wait timeout')
    ) {
      return new TransactionError('Lock timeout', error, context);
    }
    if (
      message.includes('transaction') ||
      message.includes('rollback') ||
      message.includes('commit')
    ) {
      return new TransactionError(error.message, error, context);
    }

    // Timeout errors (general)
    if (message.includes('timeout') || message.includes('timed out')) {
      return new TimeoutError('Database operation', 0, error, context);
    }

    // Permission/Authorization errors
    if (
      message.includes('permission denied') ||
      message.includes('access denied')
    ) {
      return new AuthorizationError(error.message, error, context);
    }
    if (
      message.includes('authentication failed') ||
      message.includes('login failed')
    ) {
      return new AuthorizationError(error.message, error, context);
    }

    // Schema/Structure errors
    if (message.includes('table') && message.includes('does not exist')) {
      return new SchemaError(error.message, error, context);
    }
    if (message.includes('column') && message.includes('does not exist')) {
      return new SchemaError(error.message, error, context);
    }
    if (message.includes('relation') && message.includes('does not exist')) {
      return new SchemaError(error.message, error, context);
    }

    // SQL Syntax errors
    if (message.includes('syntax error') || message.includes('sql syntax')) {
      return new QueryError(
        error.message,
        undefined,
        undefined,
        error,
        context
      );
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid')) {
      return new ValidationError(
        error.message,
        undefined,
        undefined,
        error,
        context
      );
    }

    // Pool/Connection management errors
    if (message.includes('pool') || message.includes('connection pool')) {
      return new PoolError(error.message, undefined, undefined, error, context);
    }

    // Serialization errors
    if (
      message.includes('json') ||
      message.includes('serialize') ||
      message.includes('parse')
    ) {
      return new SerializationError(error.message, undefined, error, context);
    }

    // Migration errors
    if (message.includes('migration')) {
      return new MigrationError(error.message, undefined, error, context);
    }

    // General SQL/Query errors
    if (message.includes('sql') || message.includes('query')) {
      return new QueryError(
        error.message,
        undefined,
        undefined,
        error,
        context
      );
    }

    // Default to QueryError for unrecognized errors
    return new QueryError(
      `Unrecognized error: ${error.message}`,
      undefined,
      undefined,
      error,
      context
    );
  }

  /**
   * Wrap async operations with error handling
   */
  static async withErrorHandling<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw ErrorHandler.handle(error, context);
    }
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: RefineOrmError): boolean {
    return (
      error instanceof ConnectionError ||
      error instanceof TimeoutError ||
      error instanceof PoolError ||
      (error instanceof TransactionError && error.isRecoverable()) ||
      (error instanceof QueryError &&
        error.message.toLowerCase().includes('deadlock'))
    );
  }

  /**
   * Get error severity level
   */
  static getSeverity(
    error: RefineOrmError
  ): 'low' | 'medium' | 'high' | 'critical' {
    if (
      error instanceof ValidationError ||
      error instanceof ResourceNotFoundError ||
      error instanceof SerializationError
    ) {
      return 'low';
    }

    if (
      error instanceof QueryError ||
      error instanceof ConstraintViolationError ||
      error instanceof RelationshipError
    ) {
      return 'medium';
    }

    if (
      error instanceof TransactionError ||
      error instanceof TimeoutError ||
      error instanceof PoolError ||
      error instanceof MigrationError
    ) {
      return 'high';
    }

    return 'critical'; // ConnectionError, ConfigurationError, SchemaError, DriverError, etc.
  }

  /**
   * Get recommended retry delay in milliseconds
   */
  static getRetryDelay(error: RefineOrmError, attempt: number = 1): number {
    if (!ErrorHandler.isRetryable(error)) {
      return 0;
    }

    const baseDelay = 1000; // 1 second
    const maxDelay = 30000; // 30 seconds

    // Exponential backoff with jitter
    const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
    const jitter = Math.random() * 0.1 * delay; // 10% jitter

    return Math.floor(delay + jitter);
  }

  /**
   * Get maximum retry attempts for error type
   */
  static getMaxRetries(error: RefineOrmError): number {
    if (error instanceof ConnectionError) return 3;
    if (error instanceof TimeoutError) return 2;
    if (error instanceof PoolError) return 2;
    if (error instanceof TransactionError && error.isRecoverable()) return 3;

    return 0; // No retries for other error types
  }

  /**
   * Format error for logging
   */
  static formatForLogging(error: RefineOrmError): Record<string, any> {
    return {
      timestamp: new Date().toISOString(),
      errorType: error.constructor.name || error.code || 'UnknownError',
      code: error.code,
      message: error.message,
      detailedMessage: error.getDetailedMessage(),
      statusCode: error.statusCode,
      severity: ErrorHandler.getSeverity(error),
      isRetryable: ErrorHandler.isRetryable(error),
      isRecoverable: error.isRecoverable(),
      context: error.context,
      suggestions: error.getSuggestions(),
      stack: error.stack,
      cause:
        error.cause ?
          {
            name: error.cause.name,
            message: error.cause.message,
            stack: error.cause.stack,
          }
        : undefined,
    };
  }

  /**
   * Create error summary for user display
   */
  static createUserSummary(error: RefineOrmError): {
    title: string;
    message: string;
    suggestions: string[];
    canRetry: boolean;
  } {
    const severity = ErrorHandler.getSeverity(error);
    const isRetryable = ErrorHandler.isRetryable(error);

    let title = 'Database Error';
    switch (severity) {
      case 'low':
        title = 'Validation Error';
        break;
      case 'medium':
        title = 'Query Error';
        break;
      case 'high':
        title = 'Database Operation Failed';
        break;
      case 'critical':
        title = 'Database Connection Error';
        break;
    }

    return {
      title,
      message: error.message,
      suggestions: error.getSuggestions(),
      canRetry: isRetryable,
    };
  }
}

// Error code constants
export const ERROR_CODES = {
  // Connection errors
  CONNECTION_ERROR: 'CONNECTION_ERROR',
  CONNECTION_REFUSED: 'CONNECTION_REFUSED',
  CONNECTION_TIMEOUT: 'CONNECTION_TIMEOUT',
  HOST_NOT_FOUND: 'HOST_NOT_FOUND',

  // Query errors
  QUERY_ERROR: 'QUERY_ERROR',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  INVALID_QUERY: 'INVALID_QUERY',

  // Constraint errors
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  UNIQUE_VIOLATION: 'UNIQUE_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',
  NOT_NULL_VIOLATION: 'NOT_NULL_VIOLATION',
  CHECK_VIOLATION: 'CHECK_VIOLATION',

  // Transaction errors
  TRANSACTION_ERROR: 'TRANSACTION_ERROR',
  DEADLOCK_ERROR: 'DEADLOCK_ERROR',
  LOCK_TIMEOUT: 'LOCK_TIMEOUT',

  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
  REQUIRED_FIELD_MISSING: 'REQUIRED_FIELD_MISSING',

  // Configuration errors
  CONFIGURATION_ERROR: 'CONFIGURATION_ERROR',
  DRIVER_ERROR: 'DRIVER_ERROR',
  SCHEMA_ERROR: 'SCHEMA_ERROR',

  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // System errors
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  POOL_ERROR: 'POOL_ERROR',
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
  MIGRATION_ERROR: 'MIGRATION_ERROR',
  RELATIONSHIP_ERROR: 'RELATIONSHIP_ERROR',
  TYPE_INFERENCE_ERROR: 'TYPE_INFERENCE_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// Error context builder utility
export class ErrorContext {
  private context: Record<string, any> = {};

  static create(): ErrorContext {
    return new ErrorContext();
  }

  resource(resource: string): this {
    this.context['resource'] = resource;
    return this;
  }

  operation(operation: string): this {
    this.context['operation'] = operation;
    return this;
  }

  query(query: string, params?: any[]): this {
    this.context['query'] = query;
    if (params) {
      this.context['params'] = params;
    }
    return this;
  }

  data(data: any): this {
    this.context['data'] = data;
    return this;
  }

  field(field: string, value?: any): this {
    this.context['field'] = field;
    if (value !== undefined) {
      this.context['fieldValue'] = value;
    }
    return this;
  }

  table(tableName: string): this {
    this.context['table'] = tableName;
    return this;
  }

  constraint(constraintName: string): this {
    this.context['constraint'] = constraintName;
    return this;
  }

  driver(driverName: string): this {
    this.context['driver'] = driverName;
    return this;
  }

  timeout(timeoutMs: number): this {
    this.context['timeout'] = timeoutMs;
    return this;
  }

  pool(poolSize: number, activeConnections?: number): this {
    this.context['poolSize'] = poolSize;
    if (activeConnections !== undefined) {
      this.context['activeConnections'] = activeConnections;
    }
    return this;
  }

  relationship(
    sourceTable: string,
    targetTable: string,
    relationshipType?: string
  ): this {
    this.context['sourceTable'] = sourceTable;
    this.context['targetTable'] = targetTable;
    if (relationshipType) {
      this.context['relationshipType'] = relationshipType;
    }
    return this;
  }

  migration(migrationName: string): this {
    this.context['migrationName'] = migrationName;
    return this;
  }

  meta(key: string, value: any): this {
    if (!this.context['meta']) {
      this.context['meta'] = {};
    }
    this.context['meta'][key] = value;
    return this;
  }

  timestamp(): this {
    this.context['timestamp'] = new Date().toISOString();
    return this;
  }

  build(): Record<string, any> {
    return { ...this.context };
  }
}

// Error factory for common error scenarios
export class ErrorFactory {
  /**
   * Create a connection error with appropriate context
   */
  static connectionFailed(
    message: string,
    host?: string,
    port?: number,
    cause?: Error
  ): ConnectionError {
    const context = ErrorContext.create().operation('connect').timestamp();

    if (host) context.meta('host', host);
    if (port) context.meta('port', port);

    return new ConnectionError(message, cause, context.build());
  }

  /**
   * Create a query error with query context
   */
  static queryFailed(
    message: string,
    query?: string,
    params?: any[],
    cause?: Error
  ): QueryError {
    const context = ErrorContext.create().operation('query').timestamp();

    return new QueryError(message, query, params, cause, context.build());
  }

  /**
   * Create a validation error with field context
   */
  static validationFailed(
    message: string,
    field?: string,
    value?: any,
    cause?: Error
  ): ValidationError {
    const context = ErrorContext.create().operation('validate').timestamp();

    return new ValidationError(message, field, value, cause, context.build());
  }

  /**
   * Create a constraint violation error
   */
  static constraintViolated(
    message: string,
    constraintType: string,
    tableName?: string,
    cause?: Error
  ): ConstraintViolationError {
    const context = ErrorContext.create()
      .operation('constraint_check')
      .constraint(constraintType)
      .timestamp();

    if (tableName) context.table(tableName);

    return new ConstraintViolationError(
      message,
      constraintType,
      cause,
      context.build()
    );
  }

  /**
   * Create a resource not found error
   */
  static resourceNotFound(
    resourceName: string,
    id?: any,
    cause?: Error
  ): ResourceNotFoundError {
    const context = ErrorContext.create()
      .operation('find')
      .resource(resourceName)
      .timestamp();

    return new ResourceNotFoundError(resourceName, id, cause, context.build());
  }

  /**
   * Create a transaction error
   */
  static transactionFailed(
    message: string,
    operation?: string,
    cause?: Error
  ): TransactionError {
    const context = ErrorContext.create()
      .operation(operation || 'transaction')
      .timestamp();

    return new TransactionError(message, cause, context.build());
  }
}
