/**
 * Data Validation Integration
 * Integrates Zod schemas with Drizzle for type-safe data validation
 */

// Type-only import to avoid hard dependency on zod
type ZodSchema<T = any> = {
  parseAsync(data: unknown): Promise<T>;
  parse(data: unknown): T;
};

/**
 * Validation schema definition
 */
export interface ValidationSchema<T = any> {
  /**
   * Zod schema for insert operations
   */
  insert?: ZodSchema<T>;

  /**
   * Zod schema for update operations
   */
  update?: ZodSchema<Partial<T>>;

  /**
   * Zod schema for select operations
   */
  select?: ZodSchema<T>;
}

/**
 * Validation error with detailed field-level errors
 */
export class ValidationError extends Error {
  constructor(
    public resource: string,
    public operation: 'insert' | 'update' | 'select',
    public issues: Array<{ path: string[]; message: string }>,
  ) {
    super(
      `Validation failed for ${operation} on ${resource}: ${issues.length} error(s)`,
    );
    this.name = 'ValidationError';
  }
}

/**
 * Validator class for data validation
 */
export class Validator {
  constructor(
    private schemas: Record<string, ValidationSchema>,
    private throwOnError: boolean = true,
  ) {}

  /**
   * Validate data against schema
   */
  async validate<T = any>(
    resource: string,
    data: any,
    operation: 'insert' | 'update' | 'select',
  ): Promise<T> {
    const schema = this.schemas[resource]?.[operation];

    if (!schema) {
      // No schema defined, return data as-is
      return data;
    }

    try {
      // Parse data with Zod schema
      const validated = await schema.parseAsync(data);
      return validated as T;
    } catch (error: any) {
      const issues = this.formatZodError(error);

      if (this.throwOnError) {
        throw new ValidationError(resource, operation, issues);
      } else {
        console.error(
          `[refine-sqlx] Validation error for ${resource}:`,
          issues,
        );
        return data;
      }
    }
  }

  /**
   * Format Zod error into structured issues
   */
  private formatZodError(
    error: any,
  ): Array<{ path: string[]; message: string }> {
    if (!error.errors) {
      return [{ path: [], message: error.message }];
    }

    return error.errors.map((err: any) => ({
      path: err.path || [],
      message: err.message,
    }));
  }

  /**
   * Add or update schema for a resource
   */
  setSchema(resource: string, schema: ValidationSchema): void {
    this.schemas[resource] = schema;
  }

  /**
   * Remove schema for a resource
   */
  removeSchema(resource: string): void {
    delete this.schemas[resource];
  }

  /**
   * Check if resource has validation schema
   */
  hasSchema(resource: string, operation?: 'insert' | 'update' | 'select'): boolean {
    if (!this.schemas[resource]) return false;
    if (operation) {
      return !!this.schemas[resource][operation];
    }
    return true;
  }
}

/**
 * Helper function to create validation schemas from Drizzle tables
 * This is a utility that users can use with drizzle-zod
 *
 * @example
 * ```typescript
 * import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
 * import { z } from 'zod';
 * import { users } from './schema';
 *
 * const insertUserSchema = createInsertSchema(users, {
 *   email: z.string().email(),
 *   name: z.string().min(2),
 * });
 *
 * const selectUserSchema = createSelectSchema(users);
 *
 * const schemas = {
 *   users: {
 *     insert: insertUserSchema,
 *     update: insertUserSchema.partial(),
 *     select: selectUserSchema,
 *   },
 * };
 * ```
 */
export function createValidationConfig(
  schemas: Record<string, ValidationSchema>,
  options: { throwOnError?: boolean } = {},
) {
  return {
    enabled: true,
    schemas,
    throwOnError: options.throwOnError ?? true,
  };
}
