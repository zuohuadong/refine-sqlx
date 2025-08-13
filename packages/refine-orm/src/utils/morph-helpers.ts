import type { Table, InferSelectModel } from 'drizzle-orm';
import type {
  MorphConfig,
  EnhancedMorphConfig,
  MorphResult,
  TypedMorphResult,
  ManyToManyMorphResult,
  MorphRelationUnion,
} from '../types/client.js';
import { ConfigurationError, SchemaError } from '../types/errors.js';

/**
 * Type-safe helper to create morph configuration
 */
export function createMorphConfig<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema>
): MorphConfig<TSchema> {
  return config;
}

/**
 * Type-safe helper to create enhanced morph configuration
 */
export function createEnhancedMorphConfig<
  TSchema extends Record<string, Table>,
>(config: EnhancedMorphConfig<TSchema>): EnhancedMorphConfig<TSchema> {
  return config;
}

/**
 * Type guard to check if a morph config is enhanced
 */
export function isEnhancedMorphConfig<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema> | EnhancedMorphConfig<TSchema>
): config is EnhancedMorphConfig<TSchema> {
  return (
    'pivotTable' in config || 'nested' in config || 'customLoader' in config
  );
}

/**
 * Helper to validate morph configuration
 */
export function validateMorphConfig<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema>,
  schema: TSchema
): void {
  const { typeField, idField, relationName, types } = config;

  if (!typeField || !idField || !relationName) {
    throw new ConfigurationError(
      'MorphConfig must include typeField, idField, and relationName'
    );
  }

  if (!types || Object.keys(types).length === 0) {
    throw new ConfigurationError(
      'MorphConfig must include at least one type mapping'
    );
  }

  // Validate that all referenced tables exist in schema
  for (const [typeName, tableName] of Object.entries(types)) {
    if (!schema[tableName]) {
      throw new SchemaError(
        `Table '${String(tableName)}' referenced in morph type '${typeName}' does not exist in schema`
      );
    }
  }
}

/**
 * Helper to validate enhanced morph configuration
 */
export function validateEnhancedMorphConfig<
  TSchema extends Record<string, Table>,
>(config: EnhancedMorphConfig<TSchema>, schema: TSchema): void {
  // First validate base config
  validateMorphConfig(config, schema);

  // Validate pivot table if specified
  if (config.pivotTable && !schema[config.pivotTable]) {
    throw new SchemaError(
      `Pivot table '${String(config.pivotTable)}' does not exist in schema`
    );
  }

  // Validate nested relations if specified
  if (config.nestedRelations) {
    for (const [relationName, nestedConfig] of Object.entries(
      config.nestedRelations
    )) {
      try {
        validateMorphConfig(nestedConfig, schema);
      } catch (error) {
        throw new ConfigurationError(
          `Invalid nested relation '${relationName}': ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }
  }

  // Validate loading strategy
  if (
    config.loadingStrategy &&
    !['eager', 'lazy', 'manual'].includes(config.loadingStrategy)
  ) {
    throw new ConfigurationError(
      `Invalid loading strategy '${config.loadingStrategy}'. Must be 'eager', 'lazy', or 'manual'`
    );
  }

  // Validate cache TTL
  if (
    config.cacheTTL &&
    (typeof config.cacheTTL !== 'number' || config.cacheTTL <= 0)
  ) {
    throw new ConfigurationError('Cache TTL must be a positive number');
  }
}

/**
 * Helper to extract morph type names from config
 */
export function getMorphTypeNames<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema>
): string[] {
  return Object.keys(config.types);
}

/**
 * Helper to get table name for a morph type
 */
export function getTableNameForMorphType<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema>,
  morphType: string
): keyof TSchema | undefined {
  return config.types[morphType];
}

/**
 * Helper to check if a morph type is valid
 */
export function isValidMorphType<TSchema extends Record<string, Table>>(
  config: MorphConfig<TSchema>,
  morphType: string
): boolean {
  return morphType in config.types;
}

/**
 * Helper to create a type-safe morph result
 */
export function createTypedMorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends MorphConfig<TSchema>,
>(
  baseResult: InferSelectModel<TSchema[TTable]>,
  relationData: any,
  config: TConfig
): TypedMorphResult<TSchema, TTable, TConfig> {
  return {
    ...baseResult,
    [config.relationName]: relationData,
  } as TypedMorphResult<TSchema, TTable, TConfig>;
}

/**
 * Helper to create a type-safe many-to-many morph result
 */
export function createManyToManyMorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends EnhancedMorphConfig<TSchema>,
>(
  baseResult: InferSelectModel<TSchema[TTable]>,
  relationData: any[],
  config: TConfig
): ManyToManyMorphResult<TSchema, TTable, TConfig> {
  return {
    ...baseResult,
    [config.relationName]: relationData,
  } as ManyToManyMorphResult<TSchema, TTable, TConfig>;
}

/**
 * Helper to group morph results by type
 */
export function groupMorphResultsByType<T extends Record<string, any>>(
  results: T[],
  typeField: string
): Record<string, T[]> {
  const grouped: Record<string, T[]> = {};

  for (const result of results) {
    const morphType = result[typeField];
    if (morphType) {
      if (!grouped[morphType]) {
        grouped[morphType] = [];
      }
      grouped[morphType].push(result);
    }
  }

  return grouped;
}

/**
 * Helper to extract unique morph IDs by type
 */
export function extractMorphIdsByType<T extends Record<string, any>>(
  results: T[],
  typeField: string,
  idField: string
): Record<string, Set<any>> {
  const idsByType: Record<string, Set<any>> = {};

  for (const result of results) {
    const morphType = result[typeField];
    const morphId = result[idField];

    if (morphType && morphId != null) {
      if (!idsByType[morphType]) {
        idsByType[morphType] = new Set();
      }
      idsByType[morphType].add(morphId);
    }
  }

  return idsByType;
}

/**
 * Helper to create a morph relation union type predicate
 */
export function isMorphRelationType<
  TSchema extends Record<string, Table>,
  TConfig extends MorphConfig<TSchema>,
>(
  value: any,
  config: TConfig,
  typeName: string
): value is MorphRelationUnion<TSchema, TConfig> {
  return value && typeof value === 'object' && Boolean(config.types[typeName]);
}

/**
 * Helper to safely access morph relation data
 */
export function getMorphRelationData<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends MorphConfig<TSchema>,
>(result: MorphResult<TSchema, TTable>, config: TConfig): any {
  return (result as any)[config.relationName];
}

/**
 * Helper to check if morph result has relation data
 */
export function hasMorphRelationData<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends MorphConfig<TSchema>,
>(result: MorphResult<TSchema, TTable>, config: TConfig): boolean {
  const relationData = getMorphRelationData(result, config);
  return relationData != null;
}

/**
 * Helper to get morph type from result
 */
export function getMorphTypeFromResult<T extends Record<string, any>>(
  result: T,
  typeField: string
): string | null {
  return result[typeField] || null;
}

/**
 * Helper to get morph ID from result
 */
export function getMorphIdFromResult<T extends Record<string, any>>(
  result: T,
  idField: string
): any {
  return result[idField];
}

/**
 * Helper to create a cache key for morph queries
 */
export function createMorphCacheKey<TSchema extends Record<string, Table>>(
  resource: keyof TSchema,
  config: MorphConfig<TSchema>,
  filters?: Record<string, any>
): string {
  const baseKey = `morph:${String(resource)}:${config.relationName}`;
  const typeKeys = Object.keys(config.types).sort().join(',');
  const filterKey = filters ? JSON.stringify(filters) : '';

  return `${baseKey}:${typeKeys}:${filterKey}`;
}
