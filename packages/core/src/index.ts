// Core functionality exports - only export the most commonly used
export { SqlTransformer } from './sql-transformer.js';
export { CompatibilityUtils } from './compatibility.js';
export { GradualMigrationHelper } from './compatibility.js';

// On-demand import functionality
export { createCompatibilityChecker } from './compatibility.js';

// Type definitions
export type * from './enhanced-types.js';

// Create a simple schema validator factory function
import type { BaseSchema, SchemaValidator } from './enhanced-types.js';

export function createSchemaValidator<TSchema extends BaseSchema>(
  schema: TSchema
): SchemaValidator<TSchema> {
  return {
    validateSchema: () => ({ valid: true, errors: [], warnings: [] }),
    validateRecord: () => ({ valid: true, errors: [], warnings: [] }),
    getTableInfo: () => ({
      name: '',
      columns: [],
      primaryKey: [],
      indexes: [],
      constraints: [],
    }),
    getRelationships: () => [],
  } as SchemaValidator<TSchema>;
}
