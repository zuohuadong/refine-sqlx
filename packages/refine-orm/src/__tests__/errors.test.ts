import { describe, it, expect } from 'vitest';
import {
  RefineOrmError,
  ConnectionError,
  QueryError,
  ValidationError,
  TransactionError,
  ConfigurationError,
  SchemaError,
  ResourceNotFoundError,
  ConstraintViolationError,
  TimeoutError,
  AuthorizationError,
  DriverError,
  MigrationError,
  RelationshipError,
  SerializationError,
  PoolError,
  ErrorHandler,
  ErrorContext,
  ErrorFactory,
  ERROR_CODES,
} from '../types/errors.js';

describe('Error Types', () => {
  describe('Base RefineOrmError', () => {
    class TestError extends RefineOrmError {
      readonly code = 'TEST_ERROR';
      readonly statusCode = 500;

      getSuggestions(): string[] {
        return ['Test suggestion'];
      }

      isRecoverable(): boolean {
        return true;
      }
    }

    it('should create error with detailed message', () => {
      const error = new TestError('Test message', undefined, {
        resource: 'users',
        id: 1,
      });

      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.getDetailedMessage()).toContain('resource: "users"');
      expect(error.getDetailedMessage()).toContain('id: 1');
    });

    it('should provide suggestions and recoverability info', () => {
      const error = new TestError('Test message');

      expect(error.getSuggestions()).toEqual(['Test suggestion']);
      expect(error.isRecoverable()).toBe(true);
    });

    it('should serialize to JSON correctly', () => {
      const cause = new Error('Cause error');
      const error = new TestError('Test message', cause, { resource: 'users' });
      const json = error.toJSON();

      expect(json.name).toBe('TestError');
      expect(json.message).toBe('Test message');
      expect(json.code).toBe('TEST_ERROR');
      expect(json.statusCode).toBe(500);
      expect(json.context).toEqual({ resource: 'users' });
      expect(json.suggestions).toEqual(['Test suggestion']);
      expect(json.isRecoverable).toBe(true);
      expect(json.cause).toBe('Cause error');
    });
  });

  describe('Specific Error Types', () => {
    it('should create ConnectionError with appropriate suggestions', () => {
      const error = new ConnectionError('Connection refused');

      expect(error.code).toBe('CONNECTION_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.isRecoverable()).toBe(true);
      expect(error.getSuggestions()).toContain(
        'Check if the database server is running and accessible'
      );
    });

    it('should create QueryError with query context', () => {
      const error = new QueryError('Syntax error', 'SELECT * FROM users', [
        'param1',
      ]);

      expect(error.code).toBe('QUERY_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.params).toEqual(['param1']);
      expect(error.getSuggestions()).toContain(
        'Check SQL syntax and query structure'
      );
    });

    it('should create ValidationError with field context', () => {
      const error = new ValidationError(
        'Invalid email',
        'email',
        'invalid-email'
      );

      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(422);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid-email');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should create ConstraintViolationError with constraint info', () => {
      const error = new ConstraintViolationError(
        'Unique constraint violated',
        'unique_email'
      );

      expect(error.code).toBe('CONSTRAINT_VIOLATION');
      expect(error.statusCode).toBe(409);
      expect(error.constraint).toBe('unique_email');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should create ResourceNotFoundError with resource context', () => {
      const error = new ResourceNotFoundError('users', 123);

      expect(error.code).toBe('RESOURCE_NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('users');
      expect(error.message).toContain('123');
      expect(error.isRecoverable()).toBe(true);
    });

    it('should create DriverError with driver context', () => {
      const error = new DriverError('postgres', 'Driver not found');

      expect(error.code).toBe('DRIVER_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.context?.driverName).toBe('postgres');
      expect(error.isRecoverable()).toBe(false);
    });
  });

  describe('ErrorHandler', () => {
    it('should categorize connection errors correctly', () => {
      const originalError = new Error('ECONNREFUSED: Connection refused');
      const categorized = ErrorHandler.handle(originalError);

      expect(categorized).toBeInstanceOf(ConnectionError);
      expect(categorized.message).toContain('Connection refused by server');
    });

    it('should categorize constraint violations correctly', () => {
      const originalError = new Error(
        'duplicate key value violates unique constraint'
      );
      const categorized = ErrorHandler.handle(originalError);

      expect(categorized).toBeInstanceOf(ConstraintViolationError);
      expect((categorized as ConstraintViolationError).constraint).toBe(
        'unique'
      );
    });

    it('should determine if error is retryable', () => {
      const connectionError = new ConnectionError('Connection failed');
      const validationError = new ValidationError('Invalid data');

      expect(ErrorHandler.isRetryable(connectionError)).toBe(true);
      expect(ErrorHandler.isRetryable(validationError)).toBe(false);
    });

    it('should determine error severity correctly', () => {
      const validationError = new ValidationError('Invalid data');
      const queryError = new QueryError('SQL error');
      const connectionError = new ConnectionError('Connection failed');

      expect(ErrorHandler.getSeverity(validationError)).toBe('low');
      expect(ErrorHandler.getSeverity(queryError)).toBe('medium');
      expect(ErrorHandler.getSeverity(connectionError)).toBe('critical');
    });

    it('should calculate retry delay with exponential backoff', () => {
      const connectionError = new ConnectionError('Connection failed');

      const delay1 = ErrorHandler.getRetryDelay(connectionError, 1);
      const delay2 = ErrorHandler.getRetryDelay(connectionError, 2);
      const delay3 = ErrorHandler.getRetryDelay(connectionError, 3);

      expect(delay1).toBeGreaterThan(0);
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
      expect(delay3).toBeLessThanOrEqual(30000); // Max delay
    });

    it('should format error for logging', () => {
      const error = new QueryError('SQL error', 'SELECT * FROM users');
      const formatted = ErrorHandler.formatForLogging(error);

      expect(formatted.timestamp).toBeDefined();
      expect(formatted.errorType).toBe('QueryError');
      expect(formatted.code).toBe('QUERY_ERROR');
      expect(formatted.severity).toBe('medium');
      expect(formatted.isRetryable).toBe(false);
      expect(formatted.context.query).toBe('SELECT * FROM users');
    });

    it('should create user summary', () => {
      const error = new ValidationError('Invalid email format');
      const summary = ErrorHandler.createUserSummary(error);

      expect(summary.title).toBe('Validation Error');
      expect(summary.message).toBe('Validation failed: Invalid email format');
      expect(summary.suggestions).toContain(
        'Check data types and formats match schema requirements'
      );
      expect(summary.canRetry).toBe(false);
    });
  });

  describe('ErrorContext', () => {
    it('should build context with fluent API', () => {
      const context = ErrorContext.create()
        .resource('users')
        .operation('create')
        .field('email', 'invalid@')
        .query('INSERT INTO users', ['param1'])
        .meta('attempt', 1)
        .build();

      expect(context.resource).toBe('users');
      expect(context.operation).toBe('create');
      expect(context.field).toBe('email');
      expect(context.fieldValue).toBe('invalid@');
      expect(context.query).toBe('INSERT INTO users');
      expect(context.params).toEqual(['param1']);
      expect(context.meta.attempt).toBe(1);
    });
  });

  describe('ErrorFactory', () => {
    it('should create connection error with context', () => {
      const error = ErrorFactory.connectionFailed(
        'Connection refused',
        'localhost',
        5432
      );

      expect(error).toBeInstanceOf(ConnectionError);
      expect(error.context?.operation).toBe('connect');
      expect(error.context?.meta?.host).toBe('localhost');
      expect(error.context?.meta?.port).toBe(5432);
    });

    it('should create query error with context', () => {
      const error = ErrorFactory.queryFailed(
        'Syntax error',
        'SELECT * FROM users',
        ['param1']
      );

      expect(error).toBeInstanceOf(QueryError);
      expect(error.query).toBe('SELECT * FROM users');
      expect(error.params).toEqual(['param1']);
      expect(error.context?.operation).toBe('query');
    });

    it('should create validation error with context', () => {
      const error = ErrorFactory.validationFailed(
        'Invalid email',
        'email',
        'invalid@'
      );

      expect(error).toBeInstanceOf(ValidationError);
      expect(error.field).toBe('email');
      expect(error.value).toBe('invalid@');
      expect(error.context?.operation).toBe('validate');
    });

    it('should create constraint violation error with context', () => {
      const error = ErrorFactory.constraintViolated(
        'Unique violation',
        'unique',
        'users'
      );

      expect(error).toBeInstanceOf(ConstraintViolationError);
      expect(error.constraint).toBe('unique');
      expect(error.context?.table).toBe('users');
      expect(error.context?.operation).toBe('constraint_check');
    });
  });

  describe('Error Codes', () => {
    it('should have all expected error codes', () => {
      expect(ERROR_CODES.CONNECTION_ERROR).toBe('CONNECTION_ERROR');
      expect(ERROR_CODES.QUERY_ERROR).toBe('QUERY_ERROR');
      expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ERROR_CODES.CONSTRAINT_VIOLATION).toBe('CONSTRAINT_VIOLATION');
      expect(ERROR_CODES.RESOURCE_NOT_FOUND).toBe('RESOURCE_NOT_FOUND');
      expect(ERROR_CODES.TRANSACTION_ERROR).toBe('TRANSACTION_ERROR');
      expect(ERROR_CODES.CONFIGURATION_ERROR).toBe('CONFIGURATION_ERROR');
      expect(ERROR_CODES.DRIVER_ERROR).toBe('DRIVER_ERROR');
    });
  });
});
