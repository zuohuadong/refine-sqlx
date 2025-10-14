import type { Table, InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Schema configuration for type inference
export type SchemaConfig<TSchema extends Record<string, Table>> = {
  [K in keyof TSchema]: TSchema[K] extends Table ? TSchema[K] : never;
};

// Extract table names from schema
export type TableNames<TSchema extends Record<string, Table>> = keyof TSchema;

// Extract select model from table
export type SelectModel<TTable extends Table> = InferSelectModel<TTable>;

// Extract insert model from table
export type InsertModel<TTable extends Table> = InferInsertModel<TTable>;

// Extract column names from table
export type ColumnNames<TTable extends Table> = keyof InferSelectModel<TTable>;

// Extract column type from table and column name
export type ColumnType<
  TTable extends Table,
  TColumn extends ColumnNames<TTable>,
> = InferSelectModel<TTable>[TColumn];

// Type utilities for schema manipulation
export type PartialSchema<
  TSchema extends Record<string, Table>,
  TKeys extends keyof TSchema,
> = Pick<TSchema, TKeys>;

export type OmitFromSchema<
  TSchema extends Record<string, Table>,
  TKeys extends keyof TSchema,
> = Omit<TSchema, TKeys>;

// Type guards for schema validation
export function isTable(value: unknown): value is Table {
  return (
    typeof value === 'object' && value !== null && 'Symbol.toStringTag' in value
  );
}

export function isValidSchema<TSchema extends Record<string, Table>>(
  schema: unknown
): schema is TSchema {
  if (typeof schema !== 'object' || schema === null) {
    return false;
  }

  return Object.values(schema).every(isTable);
}

// Schema transformation utilities
export type TransformSchema<
  TSchema extends Record<string, Table>,
  TTransform extends Record<keyof TSchema, Table>,
> = {
  [K in keyof TSchema]: K extends keyof TTransform ? TTransform[K] : TSchema[K];
};

export type FilterSchema<
  TSchema extends Record<string, Table>,
  TPredicate extends keyof TSchema,
> = Pick<TSchema, TPredicate>;

export type MapSchema<
  TSchema extends Record<string, Table>,
  TMapper extends (table: TSchema[keyof TSchema]) => Table,
> = { [K in keyof TSchema]: ReturnType<TMapper> };

// Advanced type utilities
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? never : K;
}[keyof T];

export type OptionalKeys<T> = {
  [K in keyof T]-?: Record<string, never> extends Pick<T, K> ? K : never;
}[keyof T];
