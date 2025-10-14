import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';

import type {
  BaseSchema,
  EnhancedDataProvider,
  UnifiedChainQuery,
  UnifiedMorphQuery,
  UnifiedMorphConfig,
  EnhancedCreateParams,
  EnhancedUpdateParams,
  EnhancedGetOneParams,
  EnhancedGetListParams,
  EnhancedGetManyParams,
  EnhancedDeleteOneParams,
  EnhancedDeleteManyParams,
  EnhancedCreateManyParams,
  EnhancedUpdateManyParams,
  EnhancedCreateResponse,
  EnhancedUpdateResponse,
  EnhancedGetOneResponse,
  EnhancedGetListResponse,
  EnhancedGetManyResponse,
  EnhancedDeleteOneResponse,
  EnhancedDeleteManyResponse,
  EnhancedCreateManyResponse,
  EnhancedUpdateManyResponse,
  InferRecord,
  SchemaValidator,
  PerformanceStats,
} from 'refine-core-utils';

import type { DrizzleClient } from './client';
import type { RefineOrmOptions } from './config';

// Drizzle-specific schema type that extends BaseSchema
export interface DrizzleSchema extends BaseSchema {
  [tableName: string]: Table;
}

// Type helper to convert Drizzle schema to BaseSchema format
export type DrizzleToBaseSchema<TSchema extends Record<string, Table>> = {
  [K in keyof TSchema]: InferSelectModel<TSchema[K]>;
};

// Enhanced Drizzle-specific record inference
export type DrizzleInferRecord<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> = InferSelectModel<TSchema[TTable]> & { id: any };

export type DrizzleInferInsertRecord<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> = InferInsertModel<TSchema[TTable]>;

// Unified RefineOrmDataProvider that implements EnhancedDataProvider
export interface UnifiedRefineOrmDataProvider<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends EnhancedDataProvider<DrizzleToBaseSchema<TSchema>> {
  // Drizzle-specific properties
  client: DrizzleClient<TSchema>;
  schema?: DrizzleToBaseSchema<TSchema>;

  // Enhanced typed CRUD operations with Drizzle types
  getListEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedGetListParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetListResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getOneEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedGetOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getManyEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedGetManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedCreateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteOneEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createManyEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedCreateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateManyEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteManyEnhanced<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  // Chain query API with Drizzle types
  from<TTable extends keyof TSchema & string>(
    resource: TTable
  ): UnifiedChainQuery<DrizzleToBaseSchema<TSchema>, TTable>;

  // Polymorphic relationship queries with Drizzle types
  morphTo<TTable extends keyof TSchema & string>(
    resource: TTable,
    morphConfig: UnifiedMorphConfig<DrizzleToBaseSchema<TSchema>>
  ): UnifiedMorphQuery<DrizzleToBaseSchema<TSchema>, TTable>;

  // Native Drizzle query builder access
  query: {
    select<TTable extends keyof TSchema & string>(
      resource: TTable
    ): DrizzleSelectChain<TSchema, TTable>;
    insert<TTable extends keyof TSchema & string>(
      resource: TTable
    ): DrizzleInsertChain<TSchema, TTable>;
    update<TTable extends keyof TSchema & string>(
      resource: TTable
    ): DrizzleUpdateChain<TSchema, TTable>;
    delete<TTable extends keyof TSchema & string>(
      resource: TTable
    ): DrizzleDeleteChain<TSchema, TTable>;
  };

  // Relationship queries with Drizzle types
  getWithRelations<TTable extends keyof TSchema & string>(
    resource: TTable,
    id: any,
    relations?: (keyof TSchema & string)[],
    relationshipConfigs?: Record<string, any>
  ): Promise<EnhancedGetOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  // Raw query support
  raw<T = any>(sql: string, params?: any[]): Promise<T[]>;

  // Transaction support with Drizzle types
  transaction<T>(
    fn: (tx: UnifiedRefineOrmDataProvider<TSchema>) => Promise<T>
  ): Promise<T>;

  // Schema validation
  validator: SchemaValidator<DrizzleToBaseSchema<TSchema>>;

  // Performance monitoring
  clearCache(): void;
  getPerformanceStats(): PerformanceStats;
}

// Drizzle-specific chain query interfaces
export interface DrizzleSelectChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  select<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns: TColumns
  ): this;

  where(condition: any): this;
  orderBy(column: any, direction?: 'asc' | 'desc'): this;
  limit(count: number): this;
  offset(count: number): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface DrizzleInsertChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  values(data: InferInsertModel<TSchema[TTable]>): this;
  values(data: InferInsertModel<TSchema[TTable]>[]): this;
  onConflict(action: 'ignore' | 'update'): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface DrizzleUpdateChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  set(data: Partial<InferInsertModel<TSchema[TTable]>>): this;
  where(condition: any): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface DrizzleDeleteChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  where(condition: any): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

// Factory function type for creating unified Drizzle data providers
export type UnifiedRefineOrmFactory<
  TSchema extends Record<string, Table> = Record<string, Table>,
> = (
  client: DrizzleClient<TSchema>,
  options?: RefineOrmOptions
) => UnifiedRefineOrmDataProvider<TSchema>;

// Database-specific factory function types
export type PostgreSQLProviderFactory<
  TSchema extends Record<string, Table> = Record<string, Table>,
> = (
  connectionString: string,
  schema: TSchema,
  options?: RefineOrmOptions & {
    pool?: { min?: number; max?: number; acquireTimeoutMillis?: number };
  }
) => UnifiedRefineOrmDataProvider<TSchema>;

export type MySQLProviderFactory<
  TSchema extends Record<string, Table> = Record<string, Table>,
> = (
  connectionString: string,
  schema: TSchema,
  options?: RefineOrmOptions & {
    pool?: { min?: number; max?: number; acquireTimeoutMillis?: number };
  }
) => UnifiedRefineOrmDataProvider<TSchema>;

export type SQLiteProviderFactory<
  TSchema extends Record<string, Table> = Record<string, Table>,
> = (
  database: string | any,
  schema: TSchema,
  options?: RefineOrmOptions
) => UnifiedRefineOrmDataProvider<TSchema>;

// Compatibility types for migration from refine-d1
export interface RefineOrmCompatibilityLayer<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  // Typed method names for enhanced type safety
  getTyped<TTable extends keyof TSchema & string>(
    params: EnhancedGetOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getListTyped<TTable extends keyof TSchema & string>(
    params: EnhancedGetListParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetListResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getManyTyped<TTable extends keyof TSchema & string>(
    params: EnhancedGetManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createTyped<TTable extends keyof TSchema & string>(
    params: EnhancedCreateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateTyped<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteTyped<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createManyTyped<TTable extends keyof TSchema & string>(
    params: EnhancedCreateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateManyTyped<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteManyTyped<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  queryTyped<T = any>(sql: string, args?: any[]): Promise<T[]>;
  executeTyped(
    sql: string,
    args?: any[]
  ): Promise<{ changes?: number; lastInsertId?: number | string }>;

  existsTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>
  ): Promise<boolean>;

  findTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>
  ): Promise<InferRecord<DrizzleToBaseSchema<TSchema>, TTable> | null>;

  findManyTyped<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        field: keyof InferRecord<DrizzleToBaseSchema<TSchema>, TTable>;
        order: 'asc' | 'desc';
      }[];
    }
  ): Promise<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>[]>;
}

// Combined interface that includes both unified and compatibility features
export interface CompleteRefineOrmDataProvider<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends UnifiedRefineOrmDataProvider<TSchema> {
  // Compatibility layer methods (avoiding conflicts by making them optional)
  getTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedGetOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getListTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedGetListParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetListResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  getManyTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedGetManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedGetManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteOneParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteOneResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  createManyTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedCreateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  updateManyTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedUpdateManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  deleteManyTypedCompat?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteManyParams<DrizzleToBaseSchema<TSchema>, TTable>
  ): Promise<EnhancedDeleteManyResponse<DrizzleToBaseSchema<TSchema>, TTable>>;

  queryTypedCompat?<T = any>(sql: string, args?: any[]): Promise<T[]>;
  executeTypedCompat?(
    sql: string,
    args?: any[]
  ): Promise<{ changes?: number; lastInsertId?: number | string }>;

  existsTypedCompat?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>
  ): Promise<boolean>;

  findTypedCompat?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>
  ): Promise<InferRecord<DrizzleToBaseSchema<TSchema>, TTable> | null>;

  findManyTypedCompat?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        field: keyof InferRecord<DrizzleToBaseSchema<TSchema>, TTable>;
        order: 'asc' | 'desc';
      }[];
    }
  ): Promise<InferRecord<DrizzleToBaseSchema<TSchema>, TTable>[]>;
}
