import type {
  BaseRecord,
  DataProvider,
  CreateParams,
  CreateResponse,
  CreateManyParams,
  CreateManyResponse,
  UpdateParams,
  UpdateResponse,
  UpdateManyParams,
  UpdateManyResponse,
  DeleteOneParams,
  DeleteOneResponse,
  DeleteManyParams,
  DeleteManyResponse,
  GetListParams,
  GetListResponse,
  GetOneParams,
  GetOneResponse,
  GetManyParams,
  GetManyResponse,
} from '@refinedev/core';

// Base schema types that work for both SQL and ORM approaches
export interface BaseSchema {
  [tableName: string]: { [columnName: string]: any };
}

// Enhanced schema with metadata for better type inference
export interface EnhancedSchema extends BaseSchema {
  [tableName: string]: {
    [columnName: string]: any;
    // Optional metadata for enhanced features
    _meta?: {
      primaryKey?: string;
      timestamps?: { createdAt?: string; updatedAt?: string };
      relationships?: { [relationName: string]: RelationshipMeta };
      polymorphic?: { [morphName: string]: PolymorphicMeta };
    };
  };
}

// Relationship metadata
export interface RelationshipMeta {
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
  relatedTable: string;
  foreignKey?: string;
  localKey?: string;
  pivotTable?: string;
  pivotLocalKey?: string;
  pivotForeignKey?: string;
}

// Polymorphic relationship metadata
export interface PolymorphicMeta {
  typeField: string;
  idField: string;
  types: Record<string, string>;
}

// Type inference helpers
export type InferRecord<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> = TSchema[TTable] & BaseRecord;

export type InferInsertRecord<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> = Omit<TSchema[TTable], 'id'> & Partial<Pick<TSchema[TTable], 'id'>>;

export type InferUpdateRecord<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> = Partial<Omit<TSchema[TTable], 'id'>>;

// Filter operators unified across both packages
export type UnifiedFilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'notIn'
  | 'like'
  | 'ilike'
  | 'notLike'
  | 'isNull'
  | 'isNotNull'
  | 'between'
  | 'notBetween'
  | 'contains'
  | 'ncontains'
  | 'containss'
  | 'ncontainss'
  | 'startswith'
  | 'nstartswith'
  | 'startswiths'
  | 'nstartswiths'
  | 'endswith'
  | 'nendswith'
  | 'endswiths'
  | 'nendswiths'
  | 'null'
  | 'nnull'
  | 'ina'
  | 'nina';

// Chain query interface that works for both SQL and ORM
export interface UnifiedChainQuery<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> {
  // Filtering methods
  where<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    operator: UnifiedFilterOperator,
    value: any
  ): this;

  whereAnd(
    conditions: Array<{
      column: keyof InferRecord<TSchema, TTable> | string;
      operator: UnifiedFilterOperator;
      value: any;
    }>
  ): this;

  whereOr(
    conditions: Array<{
      column: keyof InferRecord<TSchema, TTable> | string;
      operator: UnifiedFilterOperator;
      value: any;
    }>
  ): this;

  // Relationship methods
  with<TRelation extends keyof TSchema & string>(
    relation: TRelation,
    callback?: (
      query: UnifiedChainQuery<TSchema, TRelation>
    ) => UnifiedChainQuery<TSchema, TRelation>
  ): this;

  withHasOne<TRelation extends keyof TSchema & string>(
    relationName: string,
    relatedTable: TRelation,
    localKey?: string,
    relatedKey?: string
  ): this;

  withHasMany<TRelation extends keyof TSchema & string>(
    relationName: string,
    relatedTable: TRelation,
    localKey?: string,
    relatedKey?: string
  ): this;

  withBelongsTo<TRelation extends keyof TSchema & string>(
    relationName: string,
    relatedTable: TRelation,
    foreignKey?: string,
    relatedKey?: string
  ): this;

  withBelongsToMany<
    TRelation extends keyof TSchema & string,
    TPivot extends keyof TSchema & string,
  >(
    relationName: string,
    relatedTable: TRelation,
    pivotTable: TPivot,
    localKey?: string,
    relatedKey?: string,
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this;

  // Polymorphic relationships
  morphTo(
    morphField: string,
    morphTypes: Record<string, keyof TSchema & string>
  ): this;

  // Ordering and pagination
  orderBy<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    direction?: 'asc' | 'desc'
  ): this;

  orderByMultiple(
    orders: Array<{
      column: keyof InferRecord<TSchema, TTable> | string;
      direction?: 'asc' | 'desc';
    }>
  ): this;

  limit(count: number): this;
  offset(count: number): this;
  paginate(page: number, pageSize?: number): this;

  // Column selection
  select<K extends keyof InferRecord<TSchema, TTable>>(
    ...columns: (K | string)[]
  ): this;

  // Execution methods
  get(): Promise<InferRecord<TSchema, TTable>[]>;
  first(): Promise<InferRecord<TSchema, TTable> | null>;
  count(): Promise<number>;
  sum<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string
  ): Promise<number>;
  avg<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string
  ): Promise<number>;
  min<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string
  ): Promise<any>;
  max<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string
  ): Promise<any>;
  exists(): Promise<boolean>;

  // Pagination with metadata
  paginated(
    page?: number,
    pageSize?: number
  ): Promise<{
    data: InferRecord<TSchema, TTable>[];
    total: number;
    page: number;
    pageSize: number;
    hasNext: boolean;
    hasPrev: boolean;
  }>;

  // Utility methods
  clone(): UnifiedChainQuery<TSchema, TTable>;
}

// Polymorphic query interface
export interface UnifiedMorphQuery<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> {
  // Basic filtering
  where<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    operator: UnifiedFilterOperator,
    value: any
  ): this;

  whereType(typeName: string): this;
  whereTypeIn(typeNames: string[]): this;

  // Ordering and pagination
  orderBy<K extends keyof InferRecord<TSchema, TTable>>(
    column: K | string,
    direction?: 'asc' | 'desc'
  ): this;

  limit(limit: number): this;
  offset(offset: number): this;
  paginate(page: number, pageSize?: number): this;

  // Execution methods
  get(): Promise<
    Array<InferRecord<TSchema, TTable> & { [relationName: string]: any }>
  >;
  first(): Promise<
    (InferRecord<TSchema, TTable> & { [relationName: string]: any }) | null
  >;
  count(): Promise<number>;
}

// Polymorphic configuration
export interface UnifiedMorphConfig<TSchema extends BaseSchema> {
  typeField: string;
  idField: string;
  relationName: string;
  types: Record<string, keyof TSchema & string>;

  // Enhanced features
  pivotTable?: keyof TSchema & string;
  pivotLocalKey?: string;
  pivotForeignKey?: string;
  nested?: boolean;
  nestedRelations?: Record<string, UnifiedMorphConfig<TSchema>>;
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
  loadingStrategy?: 'eager' | 'lazy' | 'manual';
}

// Enhanced typed operation parameters
export interface EnhancedCreateParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<CreateParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferInsertRecord<TSchema, TTable>;
}

export interface EnhancedUpdateParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferUpdateRecord<TSchema, TTable>;
}

export interface EnhancedGetOneParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetOneParams, 'resource'> {
  resource: TTable;
}

export interface EnhancedGetListParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetListParams, 'resource'> {
  resource: TTable;
}

export interface EnhancedGetManyParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetManyParams, 'resource'> {
  resource: TTable;
}

export interface EnhancedDeleteOneParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteOneParams, 'resource'> {
  resource: TTable;
}

export interface EnhancedDeleteManyParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteManyParams, 'resource'> {
  resource: TTable;
}

export interface EnhancedCreateManyParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<CreateManyParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferInsertRecord<TSchema, TTable>[];
}

export interface EnhancedUpdateManyParams<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateManyParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferUpdateRecord<TSchema, TTable>;
}

// Enhanced typed response types
export interface EnhancedCreateResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<CreateResponse, 'data'> {
  data: InferRecord<TSchema, TTable>;
}

export interface EnhancedUpdateResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateResponse, 'data'> {
  data: InferRecord<TSchema, TTable>;
}

export interface EnhancedGetOneResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetOneResponse, 'data'> {
  data: InferRecord<TSchema, TTable>;
}

export interface EnhancedGetListResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetListResponse, 'data'> {
  data: InferRecord<TSchema, TTable>[];
}

export interface EnhancedGetManyResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<GetManyResponse, 'data'> {
  data: InferRecord<TSchema, TTable>[];
}

export interface EnhancedDeleteOneResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteOneResponse, 'data'> {
  data: InferRecord<TSchema, TTable>;
}

export interface EnhancedDeleteManyResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteManyResponse, 'data'> {
  data: InferRecord<TSchema, TTable>[];
}

export interface EnhancedCreateManyResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<CreateManyResponse, 'data'> {
  data: InferRecord<TSchema, TTable>[];
}

export interface EnhancedUpdateManyResponse<
  TSchema extends BaseSchema,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateManyResponse, 'data'> {
  data: InferRecord<TSchema, TTable>[];
}

// Transaction support
export interface EnhancedTransactionContext<TSchema extends BaseSchema> {
  operations: Array<{
    type: 'insert' | 'update' | 'delete' | 'select';
    resource: keyof TSchema & string;
    data?: any;
    where?: any;
    returning?: boolean;
  }>;
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

// Schema validation and introspection
export interface SchemaValidator<TSchema extends BaseSchema> {
  validateSchema(schema: TSchema): ValidationResult;
  validateRecord<TTable extends keyof TSchema & string>(
    resource: TTable,
    record: Partial<InferRecord<TSchema, TTable>>
  ): ValidationResult;
  getTableInfo<TTable extends keyof TSchema & string>(
    resource: TTable
  ): TableInfo;
  getRelationships<TTable extends keyof TSchema & string>(
    resource: TTable
  ): RelationshipInfo[];
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field?: string;
  message: string;
  code: string;
  value?: any;
}

export interface ValidationWarning {
  field?: string;
  message: string;
  code: string;
  value?: any;
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  primaryKey: string[];
  indexes: IndexInfo[];
  constraints: ConstraintInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey: boolean;
  isUnique: boolean;
  isAutoIncrement: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

export interface ConstraintInfo {
  name: string;
  type: 'primary_key' | 'foreign_key' | 'unique' | 'check';
  columns: string[];
  referencedTable?: string;
  referencedColumns?: string[];
}

export interface RelationshipInfo {
  name: string;
  type: 'one-to-one' | 'one-to-many' | 'many-to-many' | 'polymorphic';
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
  pivotTable?: string;
}

// Performance monitoring
export interface QueryMetrics {
  query: string;
  parameters?: any[];
  executionTime: number;
  rowsAffected?: number;
  resource?: string;
  operation?: string;
  timestamp: Date;
}

export interface PerformanceStats {
  totalQueries: number;
  averageExecutionTime: number;
  slowQueries: QueryMetrics[];
  errorRate: number;
  connectionPoolStats?: { active: number; idle: number; waiting: number };
}

// Main enhanced data provider interface
export interface EnhancedDataProvider<TSchema extends BaseSchema = BaseSchema>
  extends DataProvider {
  // Schema information
  schema?: TSchema;

  // Enhanced typed CRUD operations
  getListEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedGetListParams<TSchema, TTable>
  ): Promise<EnhancedGetListResponse<TSchema, TTable>>;

  getOneEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedGetOneParams<TSchema, TTable>
  ): Promise<EnhancedGetOneResponse<TSchema, TTable>>;

  getManyEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedGetManyParams<TSchema, TTable>
  ): Promise<EnhancedGetManyResponse<TSchema, TTable>>;

  createEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateParams<TSchema, TTable>
  ): Promise<EnhancedCreateResponse<TSchema, TTable>>;

  updateEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateParams<TSchema, TTable>
  ): Promise<EnhancedUpdateResponse<TSchema, TTable>>;

  deleteOneEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteOneParams<TSchema, TTable>
  ): Promise<EnhancedDeleteOneResponse<TSchema, TTable>>;

  createManyEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateManyParams<TSchema, TTable>
  ): Promise<EnhancedCreateManyResponse<TSchema, TTable>>;

  updateManyEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateManyParams<TSchema, TTable>
  ): Promise<EnhancedUpdateManyResponse<TSchema, TTable>>;

  deleteManyEnhanced?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteManyParams<TSchema, TTable>
  ): Promise<EnhancedDeleteManyResponse<TSchema, TTable>>;

  // Chain query API
  from?<TTable extends keyof TSchema & string>(
    resource: TTable
  ): UnifiedChainQuery<TSchema, TTable>;

  // Polymorphic relationship queries
  morphTo?<TTable extends keyof TSchema & string>(
    resource: TTable,
    morphConfig: UnifiedMorphConfig<TSchema>
  ): UnifiedMorphQuery<TSchema, TTable>;

  // Relationship queries
  getWithRelations?<TTable extends keyof TSchema & string>(
    resource: TTable,
    id: any,
    relations?: (keyof TSchema & string)[],
    relationshipConfigs?: Record<string, RelationshipMeta>
  ): Promise<EnhancedGetOneResponse<TSchema, TTable>>;

  // Raw query support
  executeRaw?<T = any>(sql: string, params?: any[]): Promise<T[]>;

  // Transaction support
  transaction?<T>(
    fn: (tx: EnhancedDataProvider<TSchema>) => Promise<T>
  ): Promise<T>;

  // Schema validation and introspection
  validator?: SchemaValidator<TSchema>;

  // Performance monitoring
  clearCache?(): void;
  getPerformanceStats?(): PerformanceStats;

  // Utility methods for compatibility
  getTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedGetOneParams<TSchema, TTable>
  ): Promise<EnhancedGetOneResponse<TSchema, TTable>>;

  getListTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedGetListParams<TSchema, TTable>
  ): Promise<EnhancedGetListResponse<TSchema, TTable>>;

  getManyTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedGetManyParams<TSchema, TTable>
  ): Promise<EnhancedGetManyResponse<TSchema, TTable>>;

  createTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateParams<TSchema, TTable>
  ): Promise<EnhancedCreateResponse<TSchema, TTable>>;

  updateTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateParams<TSchema, TTable>
  ): Promise<EnhancedUpdateResponse<TSchema, TTable>>;

  deleteTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteOneParams<TSchema, TTable>
  ): Promise<EnhancedDeleteOneResponse<TSchema, TTable>>;

  createManyTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedCreateManyParams<TSchema, TTable>
  ): Promise<EnhancedCreateManyResponse<TSchema, TTable>>;

  updateManyTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedUpdateManyParams<TSchema, TTable>
  ): Promise<EnhancedUpdateManyResponse<TSchema, TTable>>;

  deleteManyTyped?<TTable extends keyof TSchema & string>(
    params: EnhancedDeleteManyParams<TSchema, TTable>
  ): Promise<EnhancedDeleteManyResponse<TSchema, TTable>>;

  queryTyped?<T = any>(sql: string, args?: any[]): Promise<T[]>;
  executeTyped?(
    sql: string,
    args?: any[]
  ): Promise<{ changes?: number; lastInsertId?: number | string }>;
  existsTyped?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>
  ): Promise<boolean>;
  findTyped?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>
  ): Promise<InferRecord<TSchema, TTable> | null>;
  findManyTyped?<TTable extends keyof TSchema & string>(
    resource: TTable,
    conditions: Partial<InferRecord<TSchema, TTable>>,
    options?: {
      limit?: number;
      offset?: number;
      orderBy?: {
        field: keyof InferRecord<TSchema, TTable>;
        order: 'asc' | 'desc';
      }[];
    }
  ): Promise<InferRecord<TSchema, TTable>[]>;
}

// Factory function type for creating enhanced data providers
export type EnhancedDataProviderFactory<
  TSchema extends BaseSchema = BaseSchema,
> = (...args: any[]) => EnhancedDataProvider<TSchema>;

// Configuration options for enhanced data providers
export interface EnhancedDataProviderOptions {
  // Schema validation
  validateSchema?: boolean;
  strictMode?: boolean;

  // Performance monitoring
  enablePerformanceMonitoring?: boolean;
  slowQueryThreshold?: number;

  // Caching
  enableCaching?: boolean;
  cacheSize?: number;
  cacheTTL?: number;

  // Logging
  logger?: boolean | ((query: string, params: any[]) => void);
  debug?: boolean;

  // Connection pooling
  pool?: { min?: number; max?: number; acquireTimeoutMillis?: number };

  // Custom field mappings
  fieldMapping?: Record<string, string>;

  // Custom operators
  customOperators?: Record<string, (field: string, value: any) => any>;
}
