import type {
  BaseSchema,
  EnhancedSchema,
  SchemaValidator,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  TableInfo,
  ColumnInfo,
  IndexInfo,
  ConstraintInfo,
  RelationshipInfo,
  InferRecord,
} from './enhanced-types.js';

/**
 * Default schema validator implementation
 * Provides basic validation and introspection capabilities
 */
export class DefaultSchemaValidator<TSchema extends BaseSchema>
  implements SchemaValidator<TSchema>
{
  constructor(private schema: TSchema) {}

  /**
   * Validate the entire schema structure
   */
  validateSchema(schema: TSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for empty schema
    if (!schema || Object.keys(schema).length === 0) {
      errors.push({
        message: 'Schema is empty or undefined',
        code: 'EMPTY_SCHEMA',
      });
      return { valid: false, errors, warnings };
    }

    // Validate each table
    for (const [tableName, tableSchema] of Object.entries(schema)) {
      const tableValidation = this.validateTable(tableName, tableSchema);
      errors.push(...tableValidation.errors);
      warnings.push(...tableValidation.warnings);
    }

    // Check for relationship consistency
    const relationshipValidation = this.validateRelationships(schema);
    errors.push(...relationshipValidation.errors);
    warnings.push(...relationshipValidation.warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a single table schema
   */
  private validateTable(tableName: string, tableSchema: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for empty table
    if (!tableSchema || Object.keys(tableSchema).length === 0) {
      errors.push({
        field: tableName,
        message: `Table '${tableName}' has no columns defined`,
        code: 'EMPTY_TABLE',
      });
      return { valid: false, errors, warnings };
    }

    // Check for primary key
    const hasPrimaryKey = this.hasPrimaryKey(tableSchema);
    if (!hasPrimaryKey) {
      warnings.push({
        field: tableName,
        message: `Table '${tableName}' does not have an explicit primary key. Consider adding an 'id' field.`,
        code: 'NO_PRIMARY_KEY',
      });
    }

    // Check for reserved column names
    const reservedNames = ['constructor', 'prototype', '__proto__'];
    for (const columnName of Object.keys(tableSchema)) {
      if (columnName.startsWith('_') && columnName !== '_meta') {
        warnings.push({
          field: `${tableName}.${columnName}`,
          message: `Column name '${columnName}' starts with underscore, which may cause conflicts`,
          code: 'RESERVED_COLUMN_NAME',
        });
      }

      if (reservedNames.includes(columnName)) {
        errors.push({
          field: `${tableName}.${columnName}`,
          message: `Column name '${columnName}' is reserved and cannot be used`,
          code: 'RESERVED_COLUMN_NAME',
        });
      }
    }

    // Validate metadata if present
    if ('_meta' in tableSchema && tableSchema['_meta']) {
      const metaValidation = this.validateTableMeta(
        tableName,
        tableSchema['_meta']
      );
      errors.push(...metaValidation.errors);
      warnings.push(...metaValidation.warnings);
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Check if table has a primary key
   */
  private hasPrimaryKey(tableSchema: any): boolean {
    // Check for common primary key names
    const commonPkNames = ['id', 'uuid', 'pk'];
    for (const pkName of commonPkNames) {
      if (pkName in tableSchema) {
        return true;
      }
    }

    // Check metadata for explicit primary key
    if ('_meta' in tableSchema && tableSchema['_meta']?.primaryKey) {
      return tableSchema['_meta'].primaryKey in tableSchema;
    }

    return false;
  }

  /**
   * Validate table metadata
   */
  private validateTableMeta(tableName: string, meta: any): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate primary key reference
    if (meta.primaryKey && typeof meta.primaryKey === 'string') {
      // Primary key validation would need access to actual table schema
      // This is a simplified check
    }

    // Validate timestamp fields
    if (meta.timestamps) {
      if (
        meta.timestamps.createdAt &&
        typeof meta.timestamps.createdAt !== 'string'
      ) {
        errors.push({
          field: `${tableName}._meta.timestamps.createdAt`,
          message: 'createdAt field name must be a string',
          code: 'INVALID_TIMESTAMP_FIELD',
        });
      }

      if (
        meta.timestamps.updatedAt &&
        typeof meta.timestamps.updatedAt !== 'string'
      ) {
        errors.push({
          field: `${tableName}._meta.timestamps.updatedAt`,
          message: 'updatedAt field name must be a string',
          code: 'INVALID_TIMESTAMP_FIELD',
        });
      }
    }

    // Validate relationships
    if (meta.relationships) {
      for (const [relationName, relationMeta] of Object.entries(
        meta.relationships
      )) {
        const relationValidation = this.validateRelationshipMeta(
          tableName,
          relationName,
          relationMeta as any
        );
        errors.push(...relationValidation.errors);
        warnings.push(...relationValidation.warnings);
      }
    }

    // Validate polymorphic configurations
    if (meta.polymorphic) {
      for (const [morphName, morphMeta] of Object.entries(meta.polymorphic)) {
        const morphValidation = this.validatePolymorphicMeta(
          tableName,
          morphName,
          morphMeta as any
        );
        errors.push(...morphValidation.errors);
        warnings.push(...morphValidation.warnings);
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate relationship metadata
   */
  private validateRelationshipMeta(
    tableName: string,
    relationName: string,
    relationMeta: any
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const validTypes = ['hasOne', 'hasMany', 'belongsTo', 'belongsToMany'];
    if (!validTypes.includes(relationMeta.type)) {
      errors.push({
        field: `${tableName}._meta.relationships.${relationName}.type`,
        message: `Invalid relationship type '${relationMeta.type}'. Must be one of: ${validTypes.join(', ')}`,
        code: 'INVALID_RELATIONSHIP_TYPE',
      });
    }

    if (
      !relationMeta.relatedTable ||
      typeof relationMeta.relatedTable !== 'string'
    ) {
      errors.push({
        field: `${tableName}._meta.relationships.${relationName}.relatedTable`,
        message: 'relatedTable must be a non-empty string',
        code: 'MISSING_RELATED_TABLE',
      });
    }

    // Validate belongsToMany specific fields
    if (relationMeta.type === 'belongsToMany') {
      if (!relationMeta.pivotTable) {
        errors.push({
          field: `${tableName}._meta.relationships.${relationName}.pivotTable`,
          message: 'belongsToMany relationships require a pivotTable',
          code: 'MISSING_PIVOT_TABLE',
        });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate polymorphic metadata
   */
  private validatePolymorphicMeta(
    tableName: string,
    morphName: string,
    morphMeta: any
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    if (!morphMeta.typeField || typeof morphMeta.typeField !== 'string') {
      errors.push({
        field: `${tableName}._meta.polymorphic.${morphName}.typeField`,
        message: 'typeField must be a non-empty string',
        code: 'MISSING_TYPE_FIELD',
      });
    }

    if (!morphMeta.idField || typeof morphMeta.idField !== 'string') {
      errors.push({
        field: `${tableName}._meta.polymorphic.${morphName}.idField`,
        message: 'idField must be a non-empty string',
        code: 'MISSING_ID_FIELD',
      });
    }

    if (!morphMeta.types || typeof morphMeta.types !== 'object') {
      errors.push({
        field: `${tableName}._meta.polymorphic.${morphName}.types`,
        message: 'types must be an object mapping type names to table names',
        code: 'MISSING_TYPES_MAPPING',
      });
    } else {
      // Validate each type mapping
      for (const [typeName, targetTable] of Object.entries(morphMeta.types)) {
        if (typeof targetTable !== 'string') {
          errors.push({
            field: `${tableName}._meta.polymorphic.${morphName}.types.${typeName}`,
            message: `Type mapping '${typeName}' must reference a valid table name`,
            code: 'INVALID_TYPE_MAPPING',
          });
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate relationships across the entire schema
   */
  private validateRelationships(schema: TSchema): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const tableNames = Object.keys(schema);

    for (const [tableName, tableSchema] of Object.entries(schema)) {
      if ('_meta' in tableSchema && tableSchema['_meta']?.relationships) {
        for (const [relationName, relationMeta] of Object.entries(
          tableSchema['_meta'].relationships
        )) {
          const meta = relationMeta as any;

          // Check if related table exists
          if (!tableNames.includes(meta.relatedTable)) {
            errors.push({
              field: `${tableName}._meta.relationships.${relationName}.relatedTable`,
              message: `Related table '${meta.relatedTable}' does not exist in schema`,
              code: 'MISSING_RELATED_TABLE',
            });
          }

          // Check if pivot table exists for belongsToMany
          if (
            meta.type === 'belongsToMany' &&
            meta.pivotTable &&
            !tableNames.includes(meta.pivotTable)
          ) {
            errors.push({
              field: `${tableName}._meta.relationships.${relationName}.pivotTable`,
              message: `Pivot table '${meta.pivotTable}' does not exist in schema`,
              code: 'MISSING_PIVOT_TABLE',
            });
          }
        }
      }

      // Validate polymorphic relationships
      if ('_meta' in tableSchema && tableSchema['_meta']?.polymorphic) {
        for (const [morphName, morphMeta] of Object.entries(
          tableSchema['_meta'].polymorphic
        )) {
          const meta = morphMeta as any;

          if (meta.types) {
            for (const [typeName, targetTable] of Object.entries(meta.types)) {
              if (!tableNames.includes(targetTable as string)) {
                errors.push({
                  field: `${tableName}._meta.polymorphic.${morphName}.types.${typeName}`,
                  message: `Polymorphic target table '${targetTable}' does not exist in schema`,
                  code: 'MISSING_POLYMORPHIC_TARGET',
                });
              }
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Validate a record against the table schema
   */
  validateRecord<TTable extends keyof TSchema & string>(
    resource: TTable,
    record: Partial<InferRecord<TSchema, TTable>>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    const tableSchema = this.schema[resource];
    if (!tableSchema) {
      errors.push({
        field: resource,
        message: `Table '${resource}' does not exist in schema`,
        code: 'TABLE_NOT_FOUND',
      });
      return { valid: false, errors, warnings };
    }

    // Basic validation - check for unknown fields
    for (const fieldName of Object.keys(record)) {
      if (!(fieldName in tableSchema) && fieldName !== '_meta') {
        warnings.push({
          field: `${resource}.${fieldName}`,
          message: `Field '${fieldName}' is not defined in table schema`,
          code: 'UNKNOWN_FIELD',
        });
      }
    }

    // Check required fields (this is a simplified check)
    // In a real implementation, you'd need more metadata about required fields
    const primaryKey = this.getPrimaryKey(resource);
    if (primaryKey && !(primaryKey in record)) {
      // Only warn if this is not an insert operation
      warnings.push({
        field: `${resource}.${primaryKey}`,
        message: `Primary key '${primaryKey}' is not provided`,
        code: 'MISSING_PRIMARY_KEY',
      });
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  /**
   * Get table information
   */
  getTableInfo<TTable extends keyof TSchema & string>(
    resource: TTable
  ): TableInfo {
    const tableSchema = this.schema[resource];
    if (!tableSchema) {
      throw new Error(`Table '${resource}' does not exist in schema`);
    }

    const columns: ColumnInfo[] = [];
    const primaryKey: string[] = [];
    const indexes: IndexInfo[] = [];
    const constraints: ConstraintInfo[] = [];

    // Extract column information
    for (const [columnName, columnDef] of Object.entries(tableSchema)) {
      if (columnName === '_meta') continue;

      columns.push({
        name: columnName,
        type: this.inferColumnType(columnDef),
        nullable: true, // Default assumption
        isPrimaryKey: this.isPrimaryKeyColumn(resource, columnName),
        isUnique: false, // Would need more metadata
        isAutoIncrement: columnName === 'id' || columnName.endsWith('_id'),
      });

      if (this.isPrimaryKeyColumn(resource, columnName)) {
        primaryKey.push(columnName);
      }
    }

    // Extract metadata-based information
    if ('_meta' in tableSchema && tableSchema['_meta']) {
      const meta = tableSchema['_meta'] as any;

      if (meta.primaryKey && typeof meta.primaryKey === 'string') {
        if (!primaryKey.includes(meta.primaryKey)) {
          primaryKey.push(meta.primaryKey);
        }
      }
    }

    return { name: resource, columns, primaryKey, indexes, constraints };
  }

  /**
   * Get relationship information for a table
   */
  getRelationships<TTable extends keyof TSchema & string>(
    resource: TTable
  ): RelationshipInfo[] {
    const tableSchema = this.schema[resource];
    if (
      !tableSchema ||
      !('_meta' in tableSchema) ||
      !tableSchema['_meta']?.relationships
    ) {
      return [];
    }

    const relationships: RelationshipInfo[] = [];
    const meta = tableSchema['_meta'] as any;

    for (const [relationName, relationMeta] of Object.entries(
      meta.relationships
    )) {
      const rel = relationMeta as any;

      relationships.push({
        name: relationName,
        type: this.mapRelationType(rel.type),
        fromTable: resource,
        toTable: rel.relatedTable,
        fromColumn: rel.localKey ?? 'id',
        toColumn: rel.foreignKey ?? `${resource}_id`,
        pivotTable: rel.pivotTable,
      });
    }

    // Add polymorphic relationships
    if (meta.polymorphic) {
      for (const [morphName, morphMeta] of Object.entries(meta.polymorphic)) {
        const morph = morphMeta as any;

        for (const [typeName, targetTable] of Object.entries(morph.types)) {
          relationships.push({
            name: `${morphName}_${typeName}`,
            type: 'polymorphic',
            fromTable: resource,
            toTable: targetTable as string,
            fromColumn: morph.idField,
            toColumn: 'id',
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Get the primary key field name for a table
   */
  private getPrimaryKey<TTable extends keyof TSchema & string>(
    resource: TTable
  ): string | null {
    const tableSchema = this.schema[resource];
    if (!tableSchema) return null;

    // Check metadata first
    if ('_meta' in tableSchema && tableSchema['_meta']?.primaryKey) {
      return tableSchema['_meta'].primaryKey as string;
    }

    // Check for common primary key names
    const commonPkNames = ['id', 'uuid', 'pk'];
    for (const pkName of commonPkNames) {
      if (pkName in tableSchema) {
        return pkName;
      }
    }

    return null;
  }

  /**
   * Check if a column is a primary key
   */
  private isPrimaryKeyColumn<TTable extends keyof TSchema & string>(
    resource: TTable,
    columnName: string
  ): boolean {
    const primaryKey = this.getPrimaryKey(resource);
    return primaryKey === columnName;
  }

  /**
   * Infer column type from value
   */
  private inferColumnType(columnDef: any): string {
    if (typeof columnDef === 'string') return 'string';
    if (typeof columnDef === 'number') return 'number';
    if (typeof columnDef === 'boolean') return 'boolean';
    if (columnDef instanceof Date) return 'date';
    if (Array.isArray(columnDef)) return 'array';
    if (columnDef === null) return 'null';
    return 'unknown';
  }

  /**
   * Map relationship type to standard format
   */
  private mapRelationType(
    type: string
  ): 'one-to-one' | 'one-to-many' | 'many-to-many' | 'polymorphic' {
    switch (type) {
      case 'hasOne':
      case 'belongsTo':
        return 'one-to-one';
      case 'hasMany':
        return 'one-to-many';
      case 'belongsToMany':
        return 'many-to-many';
      default:
        return 'polymorphic';
    }
  }
}

/**
 * Create a schema validator instance
 */
export function createSchemaValidator<TSchema extends BaseSchema>(
  schema: TSchema
): SchemaValidator<TSchema> {
  return new DefaultSchemaValidator(schema);
}

/**
 * Utility function to validate a schema quickly
 */
export function validateSchema<TSchema extends BaseSchema>(
  schema: TSchema
): ValidationResult {
  const validator = createSchemaValidator(schema);
  return validator.validateSchema(schema);
}

/**
 * Utility function to check if a schema is valid
 */
export function isValidSchema<TSchema extends BaseSchema>(
  schema: TSchema
): boolean {
  const result = validateSchema(schema);
  return result.valid;
}
