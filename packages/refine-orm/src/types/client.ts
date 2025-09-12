import type {
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
  DataProvider,
} from '@refinedev/core';

import type {
  Table,
  InferSelectModel,
  InferInsertModel,
  SQL,
} from 'drizzle-orm';

// Core database client type that wraps drizzle client
export interface DrizzleClient<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  schema: TSchema;
  select(fields?: any): any;
  insert(table: any): any;
  update(table: any): any;
  delete(table: any): any;
  execute(query: any): Promise<any>;
  transaction<T>(fn: (tx: any) => Promise<T>): Promise<T>;
}

// Filter operators supported by the query builder
export type FilterOperator =
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
  | 'notBetween';

// Configuration for morph (polymorphic) relationships
export interface MorphConfig<TSchema extends Record<string, Table>> {
  typeField: string;
  idField: string;
  relationName: string;
  types: Record<string, keyof TSchema>;
}

// Enhanced configuration for complex polymorphic relationships
export interface EnhancedMorphConfig<TSchema extends Record<string, Table>>
  extends MorphConfig<TSchema> {
  // Support for many-to-many polymorphic relationships
  pivotTable?: keyof TSchema;
  pivotLocalKey?: string;
  pivotForeignKey?: string;

  // Support for nested polymorphic relationships
  nested?: boolean;
  nestedRelations?: Record<string, MorphConfig<TSchema>>;

  // Caching options
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;

  // Loading strategy
  loadingStrategy?: 'eager' | 'lazy' | 'manual';

  // Custom loading function
  customLoader?: (
    client: DrizzleClient<TSchema>,
    baseResults: any[],
    config: MorphConfig<TSchema>
  ) => Promise<Record<string, any>>;
}

// Result type for polymorphic queries
export type MorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> = InferSelectModel<TSchema[TTable]> & { [K in string]: any };

// Enhanced result type with better type inference for polymorphic relationships
export type TypedMorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends MorphConfig<TSchema>,
> = InferSelectModel<TSchema[TTable]> & {
  [K in TConfig['relationName']]: TConfig['types'] extends (
    Record<string, infer TRelatedTable>
  ) ?
    TRelatedTable extends keyof TSchema ?
      InferSelectModel<TSchema[TRelatedTable]> | null
    : any
  : any;
};

// Type for many-to-many polymorphic results
export type ManyToManyMorphResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
  TConfig extends EnhancedMorphConfig<TSchema>,
> = InferSelectModel<TSchema[TTable]> & {
  [K in TConfig['relationName']]: Array<
    TConfig['types'] extends Record<string, infer TRelatedTable> ?
      TRelatedTable extends keyof TSchema ?
        InferSelectModel<TSchema[TRelatedTable]> & { _pivot?: any }
      : any
    : any
  >;
};

// Type helper for extracting morph relation types
export type ExtractMorphTypes<TConfig extends MorphConfig<any>> =
  TConfig['types'] extends Record<string, infer TTable> ? TTable : never;

// Type helper for morph relation union
export type MorphRelationUnion<
  TSchema extends Record<string, Table>,
  TConfig extends MorphConfig<TSchema>,
> = {
  [K in keyof TConfig['types']]: TConfig['types'][K] extends keyof TSchema ?
    InferSelectModel<TSchema[TConfig['types'][K]]>
  : never;
}[keyof TConfig['types']];

// Chain query interface for fluent API
export interface ChainQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;

  with<TRelation extends keyof TSchema>(
    relation: TRelation,
    callback?: (query: any) => any
  ): this;

  // Relationship configuration methods
  withRelation<TRelation extends keyof TSchema>(
    relationName: string,
    config: RelationshipConfig<TSchema>
  ): this;

  withHasOne<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey?: string,
    relatedKey?: string
  ): this;

  withHasMany<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    localKey?: string,
    relatedKey?: string
  ): this;

  withBelongsTo<TRelation extends keyof TSchema>(
    relationName: string,
    relatedTable: TRelation,
    foreignKey?: string,
    relatedKey?: string
  ): this;

  withBelongsToMany<
    TRelation extends keyof TSchema,
    TPivot extends keyof TSchema,
  >(
    relationName: string,
    relatedTable: TRelation,
    pivotTable: TPivot,
    localKey?: string,
    relatedKey?: string,
    pivotLocalKey?: string,
    pivotRelatedKey?: string
  ): this;

  morphTo(morphField: string, morphTypes: Record<string, keyof TSchema>): this;

  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction?: 'asc' | 'desc'
  ): this;

  limit(count: number): this;
  offset(count: number): this;
  paginate(page: number, pageSize?: number): this;

  // Execution methods
  get(): Promise<InferSelectModel<TSchema[TTable]>[]>;
  first(): Promise<InferSelectModel<TSchema[TTable]> | null>;
  count(): Promise<number>;
  sum<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number>;
  avg<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): Promise<number>;
}

// Relationship configuration interface
export interface RelationshipConfig<TSchema extends Record<string, Table>> {
  // Relationship type
  type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';

  // Related table name
  relatedTable: keyof TSchema;

  // Foreign key in the current table (for belongsTo)
  foreignKey?: string;

  // Local key in the current table (for hasOne/hasMany)
  localKey?: string;

  // Related key in the related table
  relatedKey?: string;

  // Pivot table for many-to-many relationships
  pivotTable?: keyof TSchema;
  pivotLocalKey?: string;
  pivotRelatedKey?: string;

  // Loading strategy
  loadingStrategy?: 'eager' | 'lazy';

  // Custom conditions
  conditions?: SQL[];

  // Nested relationships
  with?: Record<string, RelationshipConfig<TSchema>>;
}

// Morph query interface for polymorphic relationships
export interface MorphQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  // Basic filtering and querying
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;

  whereType(typeName: string): this;
  whereTypeIn(typeNames: string[]): this;

  // Ordering and pagination
  orderBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    direction?: 'asc' | 'desc'
  ): this;

  limit(limit: number): this;
  offset(offset: number): this;
  paginate(page: number, pageSize?: number): this;

  // Execution methods
  get(): Promise<MorphResult<TSchema, TTable>[]>;
  first(): Promise<MorphResult<TSchema, TTable> | null>;
  count(): Promise<number>;
}

// Enhanced morph query interface with advanced features
export interface EnhancedMorphQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends MorphQuery<TSchema, TTable> {
  // Many-to-many polymorphic relationships
  getManyToMany(): Promise<
    ManyToManyMorphResult<TSchema, TTable, EnhancedMorphConfig<TSchema>>[]
  >;

  // Nested polymorphic relationships
  getWithNested(): Promise<MorphResult<TSchema, TTable>[]>;

  // Custom loader support
  getWithCustomLoader(): Promise<MorphResult<TSchema, TTable>[]>;
}

// Native query builder chains
export interface SelectChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends ChainQuery<TSchema, TTable> {
  select<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns: TColumns
  ): this;

  distinct(): this;
  groupBy<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn
  ): this;
  having(condition: SQL): this;
}

export interface InsertChain<
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

export interface UpdateChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  set(data: Partial<InferInsertModel<TSchema[TTable]>>): this;
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

export interface DeleteChain<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  where<TColumn extends keyof InferSelectModel<TSchema[TTable]>>(
    column: TColumn,
    operator: FilterOperator,
    value: any
  ): this;
  returning<TColumns extends (keyof InferSelectModel<TSchema[TTable]>)[]>(
    columns?: TColumns
  ): this;

  execute(): Promise<InferSelectModel<TSchema[TTable]>[]>;
}

// Re-export RefineOrmOptions from config
export type { RefineOrmOptions } from './config';

// Main RefineOrmDataProvider interface
export interface RefineOrmDataProvider<
  TSchema extends Record<string, Table> = Record<string, Table>,
> extends Omit<
    DataProvider,
    | 'getList'
    | 'getOne'
    | 'getMany'
    | 'create'
    | 'update'
    | 'deleteOne'
    | 'createMany'
    | 'updateMany'
    | 'deleteMany'
  > {
  client: DrizzleClient<TSchema>;
  schema: TSchema;
  adapter: any; // For testing purposes

  // Enhanced typed CRUD operations
  getList<TTable extends keyof TSchema & string>(
    params: GetListParams & { resource: TTable }
  ): Promise<GetListResponse<InferSelectModel<TSchema[TTable]>>>;

  getOne<TTable extends keyof TSchema & string>(
    params: GetOneParams & { resource: TTable }
  ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>>;

  getMany<TTable extends keyof TSchema & string>(
    params: GetManyParams & { resource: TTable }
  ): Promise<GetManyResponse<InferSelectModel<TSchema[TTable]>>>;

  create<TTable extends keyof TSchema & string>(
    params: CreateParams & {
      resource: TTable;
      variables: InferInsertModel<TSchema[TTable]>;
    }
  ): Promise<CreateResponse<InferSelectModel<TSchema[TTable]>>>;

  update<TTable extends keyof TSchema & string>(
    params: UpdateParams & {
      resource: TTable;
      variables: Partial<InferInsertModel<TSchema[TTable]>>;
    }
  ): Promise<UpdateResponse<InferSelectModel<TSchema[TTable]>>>;

  deleteOne<TTable extends keyof TSchema & string>(
    params: DeleteOneParams & { resource: TTable }
  ): Promise<DeleteOneResponse<InferSelectModel<TSchema[TTable]>>>;

  // Batch operations
  createMany<TTable extends keyof TSchema & string>(
    params: CreateManyParams & {
      resource: TTable;
      variables: InferInsertModel<TSchema[TTable]>[];
    }
  ): Promise<CreateManyResponse<InferSelectModel<TSchema[TTable]>>>;

  updateMany<TTable extends keyof TSchema & string>(
    params: UpdateManyParams & {
      resource: TTable;
      variables: Partial<InferInsertModel<TSchema[TTable]>>;
    }
  ): Promise<UpdateManyResponse<InferSelectModel<TSchema[TTable]>>>;

  deleteMany<TTable extends keyof TSchema & string>(
    params: DeleteManyParams & { resource: TTable }
  ): Promise<DeleteManyResponse<InferSelectModel<TSchema[TTable]>>>;

  // Chain query API
  from<TTable extends keyof TSchema & string>(
    resource: TTable
  ): ChainQuery<TSchema, TTable>;

  // Polymorphic relationship queries
  morphTo<TTable extends keyof TSchema & string>(
    resource: TTable,
    morphConfig: MorphConfig<TSchema>
  ): MorphQuery<TSchema, TTable>;

  // Native query builder
  query: {
    select<TTable extends keyof TSchema & string>(
      resource: TTable
    ): SelectChain<TSchema, TTable>;
    insert<TTable extends keyof TSchema & string>(
      resource: TTable
    ): InsertChain<TSchema, TTable>;
    update<TTable extends keyof TSchema & string>(
      resource: TTable
    ): UpdateChain<TSchema, TTable>;
    delete<TTable extends keyof TSchema & string>(
      resource: TTable
    ): DeleteChain<TSchema, TTable>;
  };

  // Relationship queries
  getWithRelations<TTable extends keyof TSchema & string>(
    resource: TTable,
    id: any,
    relations?: (keyof TSchema & string)[],
    relationshipConfigs?: Record<string, RelationshipConfig<TSchema>>
  ): Promise<GetOneResponse<InferSelectModel<TSchema[TTable]>>>;

  // Raw query support
  executeRaw<T = any>(sql: string, params?: any[]): Promise<T[]>;

  // Transaction support
  transaction<T>(
    fn: (tx: RefineOrmDataProvider<TSchema>) => Promise<T>
  ): Promise<T>;

  // Adapter information
  getAdapterInfo(): {
    type: string;
    driver: string;
    futureSupport: { bunSql: boolean };
    runtime: 'bun' | 'node';
  };
}
