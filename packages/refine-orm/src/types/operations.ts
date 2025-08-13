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
} from '@refinedev/core';

import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Enhanced typed operation parameters with schema inference
export interface TypedCreateParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<CreateParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferInsertModel<TSchema[TTable]>;
}

export interface TypedCreateManyParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<CreateManyParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: InferInsertModel<TSchema[TTable]>[];
}

export interface TypedUpdateParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: Partial<InferInsertModel<TSchema[TTable]>>;
}

export interface TypedUpdateManyParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<UpdateManyParams, 'variables' | 'resource'> {
  resource: TTable;
  variables: Partial<InferInsertModel<TSchema[TTable]>>;
}

export interface TypedDeleteOneParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteOneParams, 'resource'> {
  resource: TTable;
}

export interface TypedDeleteManyParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<DeleteManyParams, 'resource'> {
  resource: TTable;
}

export interface TypedGetListParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<GetListParams, 'resource'> {
  resource: TTable;
}

export interface TypedGetOneParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<GetOneParams, 'resource'> {
  resource: TTable;
}

export interface TypedGetManyParams<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema & string,
> extends Omit<GetManyParams, 'resource'> {
  resource: TTable;
}

// Enhanced typed response types with schema inference
export interface TypedCreateResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<CreateResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>;
}

export interface TypedCreateManyResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<CreateManyResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>[];
}

export interface TypedUpdateResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<UpdateResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>;
}

export interface TypedUpdateManyResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<UpdateManyResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>[];
}

export interface TypedDeleteOneResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<DeleteOneResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>;
}

export interface TypedDeleteManyResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<DeleteManyResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>[];
}

export interface TypedGetListResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<GetListResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>[];
}

export interface TypedGetOneResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<GetOneResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>;
}

export interface TypedGetManyResponse<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> extends Omit<GetManyResponse, 'data'> {
  data: InferSelectModel<TSchema[TTable]>[];
}

// Transaction operation types
export interface TransactionOperation<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  type: 'insert' | 'update' | 'delete' | 'select';
  resource: keyof TSchema;
  data?: any;
  where?: any;
  returning?: boolean;
}

export interface TransactionContext<
  TSchema extends Record<string, Table> = Record<string, Table>,
> {
  operations: TransactionOperation<TSchema>[];
  rollback: () => Promise<void>;
  commit: () => Promise<void>;
}

// Query building types
export interface QueryBuilder<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  table: TSchema[TTable];
  select?: (keyof InferSelectModel<TSchema[TTable]>)[];
  where?: WhereCondition<TSchema, TTable>[];
  orderBy?: OrderByCondition<TSchema, TTable>[];
  limit?: number;
  offset?: number;
  joins?: JoinCondition<TSchema>[];
}

export interface WhereCondition<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  column: keyof InferSelectModel<TSchema[TTable]>;
  operator:
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
    | 'isNull'
    | 'isNotNull';
  value?: any;
  logic?: 'and' | 'or';
}

export interface OrderByCondition<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  column: keyof InferSelectModel<TSchema[TTable]>;
  direction: 'asc' | 'desc';
}

export interface JoinCondition<TSchema extends Record<string, Table>> {
  type: 'inner' | 'left' | 'right' | 'full';
  table: keyof TSchema;
  on: { left: string; right: string };
}

// Relationship loading types - moved to client.ts to avoid conflicts

export interface WithRelationsOptions<TSchema extends Record<string, Table>> {
  relations: (keyof TSchema)[];
  nested?: boolean;
  select?: Record<keyof TSchema, string[]>;
}

// Aggregation types
export interface AggregationQuery<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  resource: TTable;
  aggregations: {
    count?: boolean;
    sum?: (keyof InferSelectModel<TSchema[TTable]>)[];
    avg?: (keyof InferSelectModel<TSchema[TTable]>)[];
    min?: (keyof InferSelectModel<TSchema[TTable]>)[];
    max?: (keyof InferSelectModel<TSchema[TTable]>)[];
  };
  groupBy?: (keyof InferSelectModel<TSchema[TTable]>)[];
  having?: WhereCondition<TSchema, TTable>[];
}

export interface AggregationResult {
  [key: string]: number | string | null;
}

// Batch operation types
export interface BatchOperation<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  type: 'create' | 'update' | 'delete';
  resource: TTable;
  data?:
    | InferInsertModel<TSchema[TTable]>[]
    | Partial<InferInsertModel<TSchema[TTable]>>[];
  where?: WhereCondition<TSchema, TTable>[];
  batchSize?: number;
}

export interface BatchResult<
  TSchema extends Record<string, Table>,
  TTable extends keyof TSchema,
> {
  success: boolean;
  processed: number;
  failed: number;
  errors: Error[];
  data?: InferSelectModel<TSchema[TTable]>[];
}

// Raw query types
export interface RawQueryOptions {
  parameters?: any[];
  timeout?: number;
  readonly?: boolean;
}

export interface RawQueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
  command?: string;
}

// Schema introspection types
export interface SchemaInfo<TSchema extends Record<string, Table>> {
  tables: { [K in keyof TSchema]: TableInfo };
  relationships: RelationshipInfo[];
}

export interface TableInfo {
  name: string;
  columns: ColumnInfo[];
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
  type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  fromTable: string;
  toTable: string;
  fromColumn: string;
  toColumn: string;
}

// Performance monitoring types
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
